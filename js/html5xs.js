/******************************************************************************/
//HTML5 Extended Video Plugin with Subtitles v0.0.13
//Original version (c) 2024 Benjamin Zachey
//related API: https://www.w3.org/TR/2011/WD-html5-20110113/video.html
/******************************************************************************/
function Html5XPlayer() {
    var infoData = null;
    var player = null;
    var ready = false;
    var ended = false;

    //Additions
    var applySubtitleStyles = function () {
        while (subtitles.classList.length > 0)
            subtitles.classList.remove(subtitles.classList.item(0));

        while (overlay.classList.length > 0)
            overlay.classList.remove(overlay.classList.item(0));

        var margin = TVXServices.storage.get('html5xs:margin')
        if (margin) overlay.classList.add(margin)

        var background = TVXServices.storage.get('html5xs:background')
        if (background) subtitles.classList.add(background)

        var font = TVXServices.storage.get('html5xs:font')
        if (font) subtitles.classList.add(font)

        var size = TVXServices.storage.get('html5xs:size')
        if (size) subtitles.classList.add(size)
    }

    var handleSettings = function (message) {
        var values = message.split(':');
        if (values.length < 3) return
        var setting = values[1];
        var value = values[2];
        if (value == 'off') TVXServices.storage.remove('html5xs:' + setting)
        else TVXServices.storage.set('html5xs:' + setting, value)
    }

    var createSettingsPanel = function() {
        var pages = [];

        var configs = {
            'Margin': {config: 'margin', classPrefix: 'm-'},
            'Size': {config: 'size', classPrefix: 'f-'},
            'Background': {config: 'background', classPrefix: 'b-'}
        }

        for (var [headline, val] of Object.entries(configs)) {

            var items = [];

            for (var i of Array(11).keys())
                items.push({
                    layout: [i % 8, Math.floor(i / 8), i == 10 ? 2 : 1, 1].join(','),
                    label: i == 0 ? 'Off' : i + '0%',
                    action: "player:commit:message:settings:" + val['config']  + ":" + (i == 0 ? 'off' : val['classPrefix'] + i)
                })

            pages.push({
                headline: headline,
                items: items
            })
        }

        items = []

        var fonts = {
            'Thin': 'roboto-thin',
            'Light': 'roboto-light',
            'Regular': 'roboto-regular',
            'Medium': 'roboto-medium',
            'Bold': 'roboto-bold',
            'Black': 'roboto-black',

            'Thin Italic': 'roboto-thin-italic',
            'Light Italic': 'roboto-light-italic',
            'Regular Italic': 'roboto-regular-italic',
            'Medium Italic': 'roboto-medium-italic',
            'Bold Italic': 'roboto-bold-italic',
            'Black Italic': 'roboto-black-italic'
        }

        for (var [i, [label, val]] of Object.entries(Object.entries(fonts)))
            items.push({
                layout: [Math.floor(i / 6) * 4, i % 6, 4, 1].join(','),
                label: label,
                action: "player:commit:message:settings:font:" + val
            })

        pages.push({
            headline: 'Font',
            items: items
        })

        var result = {
            cache: false,
            reuse: false,
            headline: "Subtitles Settings",
            type: 'list',
            pages: pages
        };
        return result
    };

    var replaceText = function(text) {
        subtitles.innerText = text;
    };

    var showText = function() {
        subtitles.classList.remove('hidden');
    };

    var hideText = function() {
        subtitles.classList.add('hidden');
    };

    var cueEnter = function() {
        replaceText(this.text);
        showText();
    };

    var cueExit = function() {
        hideText();
    };


    //--------------------------------------------------------------------------
    //Audio & Subtitle Tracks
    //--------------------------------------------------------------------------
    var PROPERTY_PREFIX = "html5x:";
    var SUBTITLES_KIND = "subtitles";
    var CAPTIONS_KIND = "captions";
    var DESCRIPTIONS_KIND = "descriptions";
    var PROXY_URL = TVXTools.getHostUrl("services/proxy.php?url={URL}");
    var useProxy = false;
    var showRelatedContent = false;
    var hasRelatedContent = false;
    var defaultAudioTrackLanguage = null;
    var defaultSubtitleTrackIndex = -1;
    var audioTrackIndicator = null;
    var subtitleTrackIndicator = null;
    var defaultExtensionLabel = null;
    var setupCrossOrigin = function(info) {
        if (player != null) {
            if (TVXPropertyTools.getBool(info, PROPERTY_PREFIX + "cors", true)) {
                player.crossOrigin = "anonymous";
            } else {
                useProxy = true;
            }
        }
    };
    var setupRelatedContent = function(info) {
        showRelatedContent = TVXPropertyTools.getBool(info, PROPERTY_PREFIX + "content", false);
        hasRelatedContent = info != null && info.index >= 0;
    };
    var setupDefaultExtensionLabel = function(info) {
        defaultExtensionLabel = TVXPropertyTools.getFullStr(info, "label:extension", null);
    };
    var hasAudioTracks = function() {
        return player != null && player.audioTracks != null && player.audioTracks.length > 0;
    };
    var hasTextTracks = function() {
        return player != null && player.textTracks != null && player.textTracks.length > 0;
    };
    var foreachAudioTrack = function(callback) {
        if (hasAudioTracks() && typeof callback == "function") {
            var tracks = player.audioTracks;
            var length = player.audioTracks.length;
            for (var i = 0; i < length; i++) {
                if (callback(i, tracks[i]) === true) {
                    break;
                }
            }
        }
    };
    var foreachSubtitleTrack = function(callback) {
        if (hasTextTracks() && typeof callback == "function") {
            var tracks = player.textTracks;
            var length = player.textTracks.length;
            for (var i = 0; i < length; i++) {
                var track = tracks[i];
                if (track.kind === SUBTITLES_KIND ||
                        track.kind === CAPTIONS_KIND ||
                        track.kind === DESCRIPTIONS_KIND) {
                    if (callback(i, track) === true) {
                        break;
                    }
                }
            }
        }
    };
    var isAudioTrackSelected = function(track) {
        return track != null && track.enabled === true;
    };
    var isSubtitleTrackSelected = function(track) {
        return track != null && (track.mode === "showing" || track.mode === "hidden");
    };
    var createIndexTrack = function(index, track) {
        if (index >= 0 && track != null) {
            return {
                index: index,
                track: track
            };
        }
        return null;
    };
    var getAudioTrackLabel = function(indexTrack) {
        var index = indexTrack != null ? indexTrack.index : -1;
        var track = indexTrack != null ? indexTrack.track : null;
        if (index >= 0 && track != null) {
            return (TVXTools.isFullStr(track.label) ? track.label : "Audio Track " + (index + 1)) +
                    (TVXTools.isFullStr(track.language) ? " (" + track.language.toUpperCase() + ")" : "");
        }
        return hasAudioTracks() ? "None" : "Original";
    };
    var getSubtitleTrackLabel = function(indexTrack) {
        var index = indexTrack != null ? indexTrack.index : -1;
        var track = indexTrack != null ? indexTrack.track : null;
        if (index >= 0 && track != null) {
            return (TVXTools.isFullStr(track.label) ? track.label : "Subtitles " + (index + 1)) +
                    (TVXTools.isFullStr(track.language) ? " (" + track.language.toUpperCase() + ")" : "");
        }
        return "Off";
    };
    var storeAudioTrack = function(track) {
        if (track != null && TVXTools.isFullStr(track.language)) {
            TVXServices.storage.set(PROPERTY_PREFIX + "audiotrack", track.language);
        } else {
            TVXServices.storage.remove(PROPERTY_PREFIX + "audiotrack");
        }
    };
    var storeSubtitleTrack = function(track) {
        if (track != null && TVXTools.isFullStr(track.language)) {
            TVXServices.storage.set(PROPERTY_PREFIX + "subtitle", track.language);
        } else {
            TVXServices.storage.remove(PROPERTY_PREFIX + "subtitle");
        }
    };
    var setupAudioTrackIndicator = function(track) {
        if (track != null && TVXTools.isFullStr(track.language)) {
            audioTrackIndicator = "{ico:msx-white:audiotrack} " + track.language.toUpperCase();
        } else {
            audioTrackIndicator = null;
        }
    };
    var setupSubtitleTrackIndicator = function(track) {
        if (track != null && TVXTools.isFullStr(track.language)) {
            subtitleTrackIndicator = "{ico:msx-white:subtitles} " + track.language.toUpperCase();
        } else {
            subtitleTrackIndicator = null;
        }
    };
    var setupExtensionLabel = function(label) {
        if (defaultExtensionLabel != null && label != null) {
            TVXVideoPlugin.setupExtensionLabel(label + " " + defaultExtensionLabel);
        } else if (label != null) {
            TVXVideoPlugin.setupExtensionLabel(label);
        } else {
            TVXVideoPlugin.setupExtensionLabel(defaultExtensionLabel);
        }
    };
    var applyIndicators = function() {
        if (audioTrackIndicator != null && subtitleTrackIndicator != null) {
            setupExtensionLabel(audioTrackIndicator + " " + subtitleTrackIndicator);
        } else if (audioTrackIndicator != null) {
            setupExtensionLabel(audioTrackIndicator);
        } else if (subtitleTrackIndicator != null) {
            setupExtensionLabel(subtitleTrackIndicator);
        } else {
            setupExtensionLabel(null);
        }
    };
    var selectAudioTrack = function(trackIndex, store, apply) {
        var selectedTrack = null;
        foreachAudioTrack(function(index, track) {
            if (index == trackIndex) {
                selectedTrack = track;
                track.enabled = true;
            } else {
                track.enabled = false;
            }
        });
        setupAudioTrackIndicator(selectedTrack);
        if (store === true) {
            storeAudioTrack(selectedTrack);
        }
        if (apply === true) {
            applyIndicators();
        }
    };

    var selectSubtitleTrack = function(trackIndex, store, apply) {
        var selectedTrack = null;
        foreachSubtitleTrack(function(index, track) {
            if (index == trackIndex) {
                selectedTrack = track;

                track.mode = "showing";

                for (var cue of track.cues) {
                    if (cue.onenter) continue
                    cue.onenter = cueEnter;
                    cue.onexit = cueExit;
                }

                track.addEventListener("cuechange", (event) => {
                    for (var cue of event.target.cues) {
                        if (cue.onenter) continue
                        cue.onenter = cueEnter;
                        cue.onexit = cueExit;
                    }
                });

                track.mode = "hidden";

            } else {
                track.mode = "disabled";
            }
        });
        setupSubtitleTrackIndicator(selectedTrack);
        if (store === true) {
            storeSubtitleTrack(selectedTrack);
        }
        if (apply === true) {
            applyIndicators();
        }
    };
    var getDefaultAudioTrackIndex = function() {
        var trackIndex = -1;
        var fallbackTrackIndex = -1;
        foreachAudioTrack(function(index, track) {
            if (fallbackTrackIndex == -1) {
                //Fallback to first audio track
                fallbackTrackIndex = index;
            }
            if (defaultAudioTrackLanguage != null && defaultAudioTrackLanguage === track.language) {
                trackIndex = index;
                return true;//break
            }
        });
        return trackIndex >= 0 ? trackIndex : fallbackTrackIndex;
    };
    var getSelectedAudioIndexTrack = function() {
        var indexTrack = null;
        foreachAudioTrack(function(index, track) {
            if (isAudioTrackSelected(track)) {
                indexTrack = createIndexTrack(index, track);
                return true;//break
            }
        });
        return indexTrack;
    };
    var getSelectedSubtitleIndexTrack = function() {
        var indexTrack = null;
        foreachSubtitleTrack(function(index, track) {
            if (isSubtitleTrackSelected(track)) {
                indexTrack = createIndexTrack(index, track);
                return true;//break
            }
        });
        return indexTrack;
    };
    var hasSelectedSubtitleTrack = function() {
        return getSelectedSubtitleIndexTrack() != null;
    };
    var setupAudioTracks = function(info) {
        defaultAudioTrackLanguage = TVXPropertyTools.getFullStr(info, PROPERTY_PREFIX + "audiotrack", TVXServices.storage.get(PROPERTY_PREFIX + "audiotrack"));
        if (defaultAudioTrackLanguage == "default") {
            defaultAudioTrackLanguage = null;//Select first audio track
        }
    };
    var processSubtitleTrackCues = function(cues) {
        if (cues != null && cues.length > 0) {
            var length = cues.length;
            //Note: On some platforms (e.g. chrome browsers and android devices), this will have no effect
            for (var i = 0; i < length; i++) {
                var cue = cues[i];
                cue.snapToLines = true;//Use integer number of lines (default is true)
                cue.line = -3;//Move the cue up to get some space at the bottom (default is -1)
            }
        }
    };
    var applySubtitleTrackCues = function() {
        foreachSubtitleTrack(function(index, track) {
            track.oncuechange = function() {
                processSubtitleTrackCues(this.activeCues);
            };
        });
    };
    var secureSubtitleSource = function(src) {
        return TVXTools.isSecureContext() ? TVXTools.secureUrl(src) : src;
    };
    var createSubtitleSource = function(src) {
        return useProxy && TVXTools.isHttpUrl(src) ? TVXTools.strReplace(PROXY_URL, "{URL}", TVXTools.strToUrlStr(src)) : src;
    };
    var createSubtitleTrack = function(subtitle, src) {
        if (TVXTools.isFullStr(subtitle) && TVXTools.isFullStr(src)) {
            var separator = subtitle.indexOf(":");
            if (separator > 0) {
                return {
                    label: subtitle.substr(separator + 1),
                    language: subtitle.substr(0, separator),
                    src: secureSubtitleSource(createSubtitleSource(src))
                };
            }
        }
        return null;
    };
    var completeSubtitleTracks = function(completeState, tracks, callback) {
        if (completeState != null) {
            completeState.size--;
            if (completeState.size == 0 && typeof callback == "function") {
                callback(tracks);
            }
        }
    };
    var resolveSubtitleTrack = function(completeState, track, tracks, callback) {
        if (track != null && !TVXTools.isHttpUrl(track.src)) {
            TVXVideoPlugin.requestInteractionResponse(track.src, function(data) {
                if (TVXTools.isFullStr(data.error)) {
                    TVXVideoPlugin.error(data.error);
                } else if (data.response != null && TVXTools.isHttpUrl(data.response.url)) {
                    track.src = createSubtitleSource(data.response.url);
                } else {
                    TVXVideoPlugin.warn("Track URL is missing or invalid");
                }
                completeSubtitleTracks(completeState, tracks, callback);
            });
        } else {
            completeSubtitleTracks(completeState, tracks, callback);
        }
    };
    var createSubtitleTracks = function(info, callback) {
        var tracks = [];
        var prefix = PROPERTY_PREFIX + "subtitle:";
        var prefixLength = prefix.length;
        var order = TVXPropertyTools.getFullStr(info, prefix + "order", null);
        TVXPropertyTools.foreach(info, function(key, value) {
            if (TVXTools.isFullStr(key) && key.indexOf(prefix) == 0) {
                var track = createSubtitleTrack(key.substr(prefixLength), value);
                if (track != null) {
                    tracks.push(track);
                }
            }
        });
        if (tracks.length > 1 && order != null) {
            tracks.sort(function(track1, track2) {
                if (order == "label") {
                    return track1.label.localeCompare(track2.label);
                } else if (order == "language") {
                    return track1.language.localeCompare(track2.language);
                }
                return 0;
            });
        }
        if (tracks.length > 0) {
            var completeState = {
                size: tracks.length
            };
            for (var i = 0; i < tracks.length; i++) {
                resolveSubtitleTrack(completeState, tracks[i], tracks, callback);
            }
        } else if (typeof callback == "function") {
            callback(tracks);
        }
    };
    var setupSubtitleTracks = function(info, callback) {
        if (player != null) {
            createSubtitleTracks(info, function(tracks) {
                defaultSubtitleTrackIndex = -1;
                var html = "";
                var defaultLanguage = TVXPropertyTools.getFullStr(info, PROPERTY_PREFIX + "subtitle", TVXServices.storage.get(PROPERTY_PREFIX + "subtitle"));
                if (defaultLanguage == "default") {
                    defaultLanguage = null;//Switch off subtitles
                }
                for (var i = 0; i < tracks.length; i++) {
                    var track = tracks[i];
                    var selected = false;
                    if (defaultLanguage != null && defaultLanguage == track.language) {
                        selected = true;
                        defaultSubtitleTrackIndex = i;
                    }
                    html += "<track" +
                            " kind='" + TVXTools.htmlAttrEscape(SUBTITLES_KIND) + "'" +
                            " label='" + TVXTools.htmlAttrEscape(track.label) + "'" +
                            " srclang='" + TVXTools.htmlAttrEscape(track.language) + "'" +
                            " src='" + TVXTools.htmlAttrEscape(track.src) + "'" +
                            (selected ? " default" : "") + "/>";
                }
                player.innerHTML = html;
                applySubtitleTrackCues();
                if (typeof callback == "function") {
                    callback();
                }
            });
        } else {
            if (typeof callback == "function") {
                callback();
            }
        }
    };
    var setupVideoInfo = function(data, callback) {
        var info = data != null && data.video != null ? data.video.info : null;
        setupCrossOrigin(info);
        setupRelatedContent(info);
        setupDefaultExtensionLabel(info);
        setupAudioTracks(info);
        setupSubtitleTracks(info, callback);
    };
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    //Player Options
    //--------------------------------------------------------------------------
    var currentOptionsFocus = null;
    var isFullscreenSupported = function() {
        if (infoData != null && TVXTools.isFullStr(infoData.platform)) {
            //Currently, the fullscreen mode only works properly on iOS/Mac devices
            return  infoData.platform.indexOf("ios") >= 0 ||
                    infoData.platform.indexOf("mac") >= 0;
        }
        return false;
    };
    var createTrackItem = function(type, index, label, selected) {
        return {
            focus: selected,
            label: label,
            extensionIcon: selected ? "check" : "blank",
            action: selected ? "back" : "player:commit:message:" + type + ":" + index
        };
    };
    var createAudioTracksPanel = function() {
        var items = [];
        if (hasAudioTracks()) {
            foreachAudioTrack(function(index, track) {
                items.push(createTrackItem("audiotrack", index, getAudioTrackLabel(createIndexTrack(index, track)), isAudioTrackSelected(track)));
            });
        } else {
            items.push(createTrackItem("audiotrack", -1, getAudioTrackLabel(null), true));
        }
        return {
            cache: false,
            reuse: false,
            headline: "Audio",
            template: {
                enumerate: false,
                type: "control",
                layout: "0,0,8,1"
            },
            items: items
        };
    };
    var createSubtitleTracksPanel = function() {
        var items = [createTrackItem("subtitle", -1, getSubtitleTrackLabel(null), !hasSelectedSubtitleTrack())];
        foreachSubtitleTrack(function(index, track) {
            items.push(createTrackItem("subtitle", index, getSubtitleTrackLabel(createIndexTrack(index, track)), isSubtitleTrackSelected(track)));
        });
        return {
            cache: false,
            reuse: false,
            headline: "Subtitles",
            template: {
                enumerate: false,
                type: "control",
                layout: "0,0,8,1"
            },
            items: items
        };
    };
    var createOptionsPanel = function() {
        var selectedAudioIndexTrack = getSelectedAudioIndexTrack();
        var selectedSubtitleIndexTrack = getSelectedSubtitleIndexTrack();
        var showFullscreen = isFullscreenSupported() && TVXVideoPlugin.isFullscreenEnabled(player);
        return {
            cache: false,
            reuse: false,
            headline: "Options",
            template: {
                enumerate: false,
                type: "control",
                layout: "0,0,8,1"
            },
            items: [{
                    focus: currentOptionsFocus == "audiotrack",
                    id: "audiotrack",
                    icon: "audiotrack",
                    label: "Audio",
                    extensionLabel: getAudioTrackLabel(selectedAudioIndexTrack),
                    action: "[player:commit:message:focus:audiotrack|panel:request:player:audiotrack]"
                }, {
                    focus: currentOptionsFocus == "subtitle",
                    id: "subtitle",
                    icon: "subtitles",
                    label: "Subtitles",
                    extensionLabel: getSubtitleTrackLabel(selectedSubtitleIndexTrack),
                    action: "[player:commit:message:focus:subtitle|panel:request:player:subtitle]"
                }, {
                    focus: currentOptionsFocus == "settings",
                    id: "settings",
                    icon: "settings",
                    label: "Settings",
                    action: "[player:commit:message:focus:settings|panel:request:player:settings]"
                }, {
                    display: showFullscreen,
                    offset: "0,0.25,0,0",
                    focus: currentOptionsFocus == "fullscreen",
                    id: "fullscreen",
                    icon: "fullscreen",
                    label: "Fullscreen",
                    action: "[player:commit:message:focus:fullscreen|player:commit:message:fullscreen]"
                }, {
                    display: showRelatedContent,
                    offset: showFullscreen ? "0,0.5,0,0" : "0,0.25,0,0",
                    enable: hasRelatedContent,
                    focus: currentOptionsFocus == "content",
                    id: "content",
                    icon: "pageview",
                    label: "Related Content",
                    action: "[player:commit:message:focus:content|player:content]"
                }]
        };
    };

    var handleMessage = function(message) {
        if (TVXTools.isFullStr(message)) {
            if (message.indexOf("focus:") == 0) {
                currentOptionsFocus = message.substr(6);
            } else if (message.indexOf("audiotrack:") == 0) {
                TVXVideoPlugin.executeAction("cleanup");
                selectAudioTrack(TVXTools.strToNum(message.substr(11), -1), true, true);
            } else if (message.indexOf("subtitle:") == 0) {
                TVXVideoPlugin.executeAction("cleanup");
                selectSubtitleTrack(TVXTools.strToNum(message.substr(9), -1), true, true);
            } else if (message == "fullscreen") {
                TVXVideoPlugin.executeAction("cleanup");
                TVXVideoPlugin.requestFullscreen(player);
            } else if (message.indexOf("settings:") == 0) {
                //TVXVideoPlugin.executeAction("cleanup");
                handleSettings(message)
                applySubtitleStyles()
            } else {
                TVXVideoPlugin.warn("Unknown plugin message: '" + message + "'");
            }
        }
    };
    var createResponseData = function(dataId) {
        if (TVXTools.isFullStr(dataId)) {
            if (dataId == "options") {
                return createOptionsPanel();
            } else if (dataId == "audiotrack") {
                return createAudioTracksPanel();
            } else if (dataId == "subtitle") {
                return createSubtitleTracksPanel();
            } else if (dataId == "settings") {
                return createSettingsPanel();
            }
        }
        return null;
    };
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    //Event Callbacks
    //--------------------------------------------------------------------------
    var onWaiting = function() {
        TVXVideoPlugin.startLoading();
    };
    var onPlaying = function() {
        TVXVideoPlugin.stopLoading();
        TVXVideoPlugin.setState(TVXVideoState.PLAYING);
    };
    var onPaused = function() {
        TVXVideoPlugin.stopLoading();
        TVXVideoPlugin.setState(TVXVideoState.PAUSED);
    };
    var onContinue = function() {
        TVXVideoPlugin.stopLoading();
    };
    var onReady = function() {
        if (player != null && !ready) {
            ready = true;
            TVXVideoPlugin.debug("Video ready");
            selectAudioTrack(getDefaultAudioTrackIndex(), false, false);
            selectSubtitleTrack(defaultSubtitleTrackIndex, false, true);
            TVXVideoPlugin.applyVolume();
            TVXVideoPlugin.stopLoading();
            TVXVideoPlugin.startPlayback(true);//Accelerated start
        }
    };
    var getErrorText = function(code) {
        if (code == 1) {
            //The fetching of the associated resource was aborted by the user's request.
            return "Playback Aborted";
        } else if (code == 2) {
            //Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available.
            return "Network Error";
        } else if (code == 3) {
            //Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error.
            return "Media Decode Error";
        } else if (code == 4) {
            //The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable.
            return "Source Not Supported";
        }
        return "Unknown Error";
    };
    var getErrorMessage = function(code, message) {
        var msg = code + ": " + getErrorText(code);
        if (TVXTools.isFullStr(message)) {
            msg += ": " + message;
        }
        return msg;
    };
    var onError = function() {
        if (player != null && player.error != null) {
            TVXVideoPlugin.error("Video error: " + getErrorMessage(player.error.code, player.error.message));
            TVXVideoPlugin.stopLoading();
        }
    };
    var onEnded = function() {
        if (!ended) {
            ended = true;
            TVXVideoPlugin.debug("Video ended");
            TVXVideoPlugin.stopPlayback();
        }
    };
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    //Helper Functions
    //--------------------------------------------------------------------------
    var setupVideoWithId = function(id) {
        if (TVXTools.isFullStr(id)) {
            TVXVideoPlugin.requestInteractionResponse(id, function(data) {
                if (TVXTools.isFullStr(data.error)) {
                    TVXVideoPlugin.error(data.error);
                    TVXVideoPlugin.stopLoading();
                } else if (!setupVideoWithUrl(data.response != null ? data.response.url : null)) {
                    TVXVideoPlugin.warn("Video URL is missing");
                    TVXVideoPlugin.stopLoading();
                }
            });
            return true;
        }
        return false;
    };

    var setupVideoWithUrl = function(url) {
        //Note: URL does not need to be an HTTP/HTTPS URL (it can be any URL)
        if (TVXTools.isFullStr(url)) {
            TVXVideoPlugin.requestData("video:info", function(data) {
                setupVideoInfo(data, function() {
                    player.src = url;
                    player.load();
                });
            });
            return true;
        }
        return false;
    };
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    //Player Interface
    //--------------------------------------------------------------------------
    this.init = function() {
        player = document.getElementById("player");
        player.addEventListener("canplay", onReady);
        player.addEventListener("error", onError);
        player.addEventListener("ended", onEnded);
        player.addEventListener("waiting", onWaiting);
        player.addEventListener("play", onContinue);
        player.addEventListener("playing", onPlaying);
        player.addEventListener("pause", onPaused);
        player.addEventListener("seeked", onContinue);
        player.addEventListener("abort", onContinue);
    };

    this.ready = function() {
        if (player != null) {
            TVXVideoPlugin.debug("Video plugin ready");
            TVXVideoPlugin.startLoading();

            applySubtitleStyles();

            TVXVideoPlugin.requestData("info:base", function(data) {
                infoData = data.info;
                if (!setupVideoWithId(TVXServices.urlParams.get("id")) &&
                        !setupVideoWithUrl(TVXServices.urlParams.get("url"))) {
                    TVXVideoPlugin.warn("Video ID or URL is missing");
                    TVXVideoPlugin.stopLoading();
                }
            });
        } else {
            TVXVideoPlugin.error("Video player is not initialized");
        }
    };
    this.dispose = function() {
        if (player != null) {
            player.removeEventListener("canplay", onReady);
            player.removeEventListener("error", onError);
            player.removeEventListener("ended", onEnded);
            player.removeEventListener("waiting", onWaiting);
            player.removeEventListener("play", onContinue);
            player.removeEventListener("playing", onPlaying);
            player.removeEventListener("pause", onPaused);
            player.removeEventListener("seeked", onContinue);
            player.removeEventListener("abort", onContinue);
            player = null;
        }
    };
    this.play = function() {
        if (player != null) {
            player.play();
        }
    };
    this.pause = function() {
        if (player != null) {
            player.pause();
        }
    };
    this.stop = function() {
        if (player != null) {
            //Note: Html5 player does not support stop -> use pause
            player.pause();
        }
    };
    this.getDuration = function() {
        if (player != null) {
            //Note: For live content, the duration could be infinity -> Return position instead
            //return player.duration;
            return isFinite(player.duration) ? player.duration : player.currentTime;
        }
        return 0;
    };
    this.getPosition = function() {
        if (player != null) {
            return player.currentTime;
        }
        return 0;
    };
    this.setPosition = function(position) {
        if (player != null) {
            player.currentTime = position;
        }
    };
    this.setVolume = function(volume) {
        if (player != null) {
            player.volume = volume / 100;
        }
    };
    this.getVolume = function() {
        if (player != null) {
            return player.volume * 100;
        }
        return 100;
    };
    this.setMuted = function(muted) {
        if (player != null) {
            player.muted = muted;
        }
    };
    this.isMuted = function() {
        if (player != null) {
            return player.muted;
        }
        return false;
    };
    this.getSpeed = function() {
        if (player != null) {
            return player.playbackRate;
        }
        return 1;
    };
    this.setSpeed = function(speed) {
        if (player != null) {
            player.playbackRate = speed;
        }
    };
    this.getUpdateData = function() {
        return {
            position: this.getPosition(),
            duration: this.getDuration(),
            speed: this.getSpeed()
        };
    };
    this.handleData = function(data) {
        handleMessage(data.message);
    };
    this.handleRequest = function(dataId, data, callback) {
        callback(createResponseData(dataId));
    };
    //--------------------------------------------------------------------------
}
/******************************************************************************/

/******************************************************************************/
//Setup
/******************************************************************************/
TVXPluginTools.onReady(function() {
    TVXVideoPlugin.setupPlayer(new Html5XPlayer());
    TVXVideoPlugin.init();
});
/******************************************************************************/