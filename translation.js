// Short alias to translate a specific string
_T = function(phrase) {
	return Translation.TranslateText(phrase);
}

// ========================= Translation Class ===============================/
var Translation = {};

// This will be initialized with the translation data
Translation.data = null;

// Set to TRUE to disable translation altogether. This means the language selector will not be visible,
// and all the UI will *always* be in English, regardless of cookies, parameters, or previous user state.
// Once set to FALSE again, everything will be back to normal, and UI will return to the use language.
Translation.skip = false; // << Set to TRUE for panic mode!

// Whether the 'Translate' was processed already
Translation.urlParamProcessed = false;

// Should we print debug info to console?
Translation.debugToConsole = false;

Translation.staticSelectorPosition = false;

Translation.showSelector = false;

// Sets the translation data upon initialization
Translation.setData = function(data) {
	Translation.data = data;
}

Translation.enabled = function()
{
	enabled = true;
	if (Translation.skip) enabled = false;
	if (typeof(mode) != 'undefined' && mode == 'view') enabled = false;
	return enabled;
}

// Get the user language
Translation.language = function() {
	var lang = 'en';
	if (Translation.skip)
		return lang;
	if (!Translation.urlParamProcessed)
	{
		var urlParam = Translation.GetUrlParam('translate');
		if (urlParam)
		{
			Translation.SetCookie('im_language', urlParam, 365*15, '/');
			lang = urlParam;
		}
		Translation.urlParamProcessed = true;
	}
	lang = Translation.GetCookie('im_language');
	if(lang==null) lang = 'en';
	if (lang != 'en') Translation.showSelector = true;
	return lang;
}

Translation.isRTL = function() {
	var lang = Translation.language();
	return (lang == 'he' || lang == 'ar');
}

Translation.direction = function() {
	return Translation.isRTL() ? 'rtl' : 'ltr';
}

// Quote text for a regular express
Translation.PregQuote = function(str) {
	return (str + '').replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,
			"\\$1");
}

Translation.SwitchTo = function(lang)
{
	if (lang == Translation.language()) return; // Don't switch to same language
	Translation.ToggleDropdown();
	var urlWithoutParam = Translation.RemoveParamFromURL('translate');
	if (typeof(CurrentWebsite) != 'undefined' && CurrentWebsite() && Editor && Editor.mode != 'view')
	{
		// Currently editing a website, save it first
		CurrentWebsite().SaveToServer(function afterSaved(saved)
		{
			Translation.ActuallySwitchTo(lang);
			Editor.EnableCheckOnClose(false);
			window.location.replace(urlWithoutParam);
		})
	}
	else
	{
		Translation.ActuallySwitchTo(lang);
		window.location.reload();
	}
}

Translation.ActuallySwitchTo = function(lang)
{
	for ( var idx in Translation.data.phrases)
	{
		var phrase = Translation.data.phrases[idx];
		if (phrase['kw'] == '#{LANGUAGE_ENGLISH_ABBREVIATION}#') langAbbrs = phrase;
	}
	var abbr = langAbbrs[lang];
	$('.language-selector .button').html(abbr);
	Translation.SetCookie('im_language', lang, 365*15, '/');

}

// Translate a string
Translation.TranslateText = function(text) {
	if (!Translation.data)
		return text;

	if (text == null) {
		console.log("Got null text");
		return null;
	}
	originalText = text.toLowerCase();
	if (Translation.debugToConsole && console.time) console.time("TranslateText");
	Translation.TranslateInternal(function replaceFunction(search, replace,
			type) {
		text = text.replace(search, replace);
	});
	if (Translation.debugToConsole && console.timeEnd) console.timeEnd("TranslateText");
	if (Translation.debugToConsole) console.log("Translated text: " + originalText + " to " + text);
	return text;
}


// Translate a certain piece of DOM
Translation.TranslateDom = function(rootDomElement) {
	if (!Translation.data)
		return;
	console.log("Translation enabled? ", Translation.enabled());
	if (console.time) console.time("Translate");
	if (Translation.enabled())
	{
		if (Translation.isRTL())
		{
			var cssLocation = '../css/translation/rtl.css';
			if ($(".additionalCss").size() != 1) {
				alert('Translation: there must be one additionalCss DIV in DOM. There are '
						+ $(".additionalCss").size());
			}
			if (typeof ($('.nonExistingDiv').replaceText) != 'function') {
				alert('Translation: jquery.ba-replacetext.js is not included');
			}
			$('<link rel="stylesheet" type="text/css" href="' + cssLocation + '" >')
					.appendTo(".additionalCss");
			console.log("Added " + cssLocation);
		}
		Translation.InsertLanguageSelector(rootDomElement);
		$(window).resize(function()
		{
			Translation.AdjustLanguageSelectorPosition();
		});
	}else{
		$('.language-selector-placeholder').hide();
	}
	var elementsToReplace = rootDomElement.find('*').not('.website').not(
	'.website *').not('IMG');
	Translation.TranslateInternal(function replaceFunction(search, replace,
			type) {

		//if (Translation.debugToConsole) console.log("Elements to replace, after: " + elementsToReplace.size())
		//if (Translation.debugToConsole) console.log("Replacing " + type + " '" + search + "' with '" + replace+ "'");
		elementsToReplace.replaceText(search, replace, false);

	});
	if (console.timeEnd) console.timeEnd("Translate");
}

Translation.ToggleDropdown = function()
{
	var dd = $('.language-selector .dropdown');
	var display = dd.css('display');
	if (display == 'none')
	{
		dd.slideDown(250);
		$(document).bind('mousedown', function(e) {
			var target = $( e.target );
			// It it's not the language selector button
			if (target.parents('.language-selector').size() == 0)
			{
				$(document).unbind('mousedown');
				Translation.ToggleDropdown();
			}
		});
	}
	else
	{
		dd.hide();
		$(document).unbind('mousedown');
	}
}

Translation.InsertLanguageSelector = function(rootDomElement) {
	if (Translation.showSelector){
		var langAbbrs, langNames;
		for ( var idx in Translation.data.phrases)
		{
			var phrase = Translation.data.phrases[idx];
			if (phrase['kw'] == '#{LANGUAGE_ENGLISH_ABBREVIATION}#') langAbbrs = phrase;
			if (phrase['kw'] == '#{LANGUAGE_NATIVE_NAME}#') langNames = phrase;
		}
		var currentLang = Translation.language();
		var abbr = langAbbrs[currentLang];
		  html = "<DIV class='language-selector'><A class='button' href='javascript:void(0);' onclick='Translation.ToggleDropdown()'>"+abbr+"</A><DIV class='dropdown'><UL>"
		for (var idx in langAbbrs)
		{
			if (idx == 'kw') continue;
			var abbr = langAbbrs[idx];
			var name = langNames[idx];
			var selected = (idx == currentLang) ? 'selected' : '';
			html += "<LI><A class='"+selected+"' HREF='javascript:void(0);' ONCLICK='Translation.SwitchTo(\""+idx+"\")'>" + abbr + " - " + name + "</A></LI>";
		}
		html += "</UL></DIV></DIV>";
		var selector = $(html);
		rootDomElement.prepend(selector);



		var onMenu = $('.menu').size() > 0;
		if (!onMenu) // there's no menu, like on: /start
		{
			Translation.InsertLanguageSelectorOn(10, 0, Translation.isRTL() ? false : true);
			Translation.staticSelectorPosition = true;
			return;
		}

		if (Translation.isRTL())
		{
			var positionInterval = setInterval(function(){
				var ph = $('.language-selector-placeholder:visible');
				if (ph.size() != 1)
				{
					return;
				}
				var pos = ph.offset();
				if (pos.left < 200) // Wait until RTL.css is fully applied...
				{
					clearInterval(positionInterval);
					Translation.InsertLanguageSelectorInternal();
				}
			}, 200);
		}
		else
		{
			setTimeout(
			function() {
				Translation.InsertLanguageSelectorInternal(rootDomElement, html);
			},0);
		}
	}else{
		$('.language-selector-placeholder').hide();
	}
}


Translation.AdjustLanguageSelectorPosition = function()
{
	if (Translation.staticSelectorPosition) return;
	var ph = $('.language-selector-placeholder:visible');
	if (ph.size() != 1) return;
	var pos = ph.offset();
	$('.language-selector').css('left', pos.left + 'px');
	$('.language-selector').css('top',  pos.top + 'px');
}

Translation.InsertLanguageSelectorInternal = function()
{
	var ph = $('.language-selector-placeholder:visible');
	if (ph.size() != 1)
	{
		console.error(ph.size() + ' Language Selector placeholders found');
		return;
	}
	var pos = ph.offset();
	Translation.InsertLanguageSelectorOn(pos.left, pos.top);


}

Translation.InsertLanguageSelectorOn = function(x, y, right)
{
	$('.language-selector').css(right ? 'right' : 'left', x + 'px');
	$('.language-selector').css('top',  y + 'px');
	$('.language-selector').show();
}


Translation.ShowButton = function(rootDomElement)
{
	var ph = $('.language-selector-placeholder:visible');
	if (ph.size() != 1)
	{
		console.error(ph.size() + ' Language Selector placeholders found')
		return;
	}
	var pos = ph.offset();
	var selector = $(html);
	rootDomElement.prepend(selector);
	$('.language-selector').css('left', pos.left + 'px');
	$('.language-selector').css('top', pos.top + 'px');
	$('.language-selector').show();
}

// Internal function which goes over dictionary and calls the "callback" to make
// the translations
Translation.TranslateInternal = function(callback) {
	if (!Translation.data)
		return;

	var lang = Translation.language();

	for ( var idx in Translation.data.phrases) {
		var phrase = Translation.data.phrases[idx];
		if (!phrase['kw'])
			continue; // we will handle non-keywords later
		var phraseToReplace = phrase['kw'];
		var phraseTranslation = phrase[lang];
		callback(new RegExp(phraseToReplace, 'gi'), phraseTranslation,
				'keyword');
	}

	var translateWords = Translation.language() != 'en';
	if (translateWords) {
		for ( var idx in Translation.data.phrases) {
			var phrase = Translation.data.phrases[idx];
			if (phrase['kw'])
				continue; // we handled keywords before
			var phraseToReplace = phrase['en'];
			var regex = false;
			if (!regex) // it's plain text, quote it
			{
				phraseToReplace = Translation.PregQuote(phraseToReplace);
				phraseToReplace = '\\b' + phraseToReplace;
				var lastChar = phraseToReplace.charAt( phraseToReplace.length-1 );
				if (lastChar!='?' && lastChar!='!' && lastChar!='.') phraseToReplace += '\\b';

			}
			var phraseTranslation = phrase[lang];
			callback(new RegExp(phraseToReplace, 'gi'), phraseTranslation,
					'english');
		}
	}
}





// ========================== HELPER FUNCTIONS =============================/


Translation.SetCookie = function( name, value, expires, path, domain, secure )
{
	// set time, it's in milliseconds
	var today = new Date();
	today.setTime( today.getTime() );

	/*
	 * if the expires variable is set, make the correct expires time, the
	 * current script below will set it for x number of days, to make it for
	 * hours, delete * 24, for minutes, delete * 60 * 24
	 */
	if ( expires )
	{
	expires = expires * 1000 * 60 * 60 * 24;
	}
	var expires_date = new Date( today.getTime() + (expires) );

	document.cookie = name + "=" +escape( value ) +
	( ( expires ) ? ";expires=" + expires_date.toGMTString() : "" ) +
	( ( path ) ? ";path=" + path : "" ) +
	( ( domain ) ? ";domain=" + domain : "" ) +
	( ( secure ) ? ";secure" : "" );
}


Translation.GetCookie = function( check_name ) {
	// first we'll split this cookie up into name/value pairs
	// note: document.cookie only returns name=value, not the other components
	var a_all_cookies = document.cookie.split( ';' );
	var a_temp_cookie = '';
	var cookie_name = '';
	var cookie_value = '';
	var b_cookie_found = false; // set boolean t/f default f

	for ( i = 0; i < a_all_cookies.length; i++ )
	{
		// now we'll split apart each name=value pair
		a_temp_cookie = a_all_cookies[i].split( '=' );


		// and trim left/right whitespace while we're at it
		cookie_name = a_temp_cookie[0].replace(/^\s+|\s+$/g, '');

		// if the extracted name matches passed check_name
		if ( cookie_name == check_name )
		{
			b_cookie_found = true;
			// we need to handle case where cookie has no value but exists (no =
			// sign, that is):
			if ( a_temp_cookie.length > 1 )
			{
				cookie_value = unescape( a_temp_cookie[1].replace(/^\s+|\s+$/g, '') );
			}
			// note that in cases where cookie is initialized but no value, null
			// is returned
			return cookie_value;
			break;
		}
		a_temp_cookie = null;
		cookie_name = '';
	}
	if ( !b_cookie_found )
	{
		return null;
	}
}

Translation.ParseUrl = function() {
	var options = {

		url : window.location, // default URI is the page in which the script
								// is running

		strictMode : false, // 'loose' parsing by default

		key : [ "source", "protocol", "authority", "userInfo", "user",
				"password", "host", "port", "relative", "path", "directory",
				"file", "query", "anchor" ], // keys available to query

		q : {
			name : "queryKey",
			parser : /(?:^|&)([^&=]*)=?([^&]*)/g
		},

		parser : {
			strict : /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
			loose : /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
		}

	};
	str = decodeURI(options.url);
	var m = options.parser[options.strictMode ? "strict" : "loose"].exec(str);

	var uri = {};
	var i = 14;

	while (i--) {
		uri[options.key[i]] = m[i] || "";
	}

	uri[options.q.name] = {};
	uri[options.key[12]].replace(options.q.parser, function($0, $1, $2) {
		if ($1) {
			uri[options.q.name][$1] = $2;
		}
	});
	return uri;
}

Translation.RemoveParamFromURL = function(variable_name){
	   var locHash = window.location.hash;
	   var URL = window.location.href;
	   var regex = new RegExp( "\\?" + variable_name + "=[^&]*&?", "gi");
	   URL = URL.replace(regex,'?');
	   regex = new RegExp( "\\&" + variable_name + "=[^&]*&?", "gi");
	   URL = URL.replace(regex,'&');
	   URL = URL.replace(/(\?|&)$/,'');
	   regex = null;
	   return URL + locHash;
}

Translation.GetUrlParam = function(item)
{
	var parsed = Translation.ParseUrl();
	return ( parsed.queryKey[item] === null ) ? null : parsed.queryKey[item];
}
