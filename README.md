# msx-html5xs
Media Station X HTML5X player with styled subtitles.

That's a mod of the original HTML5X player that allows to replace subtitles with a custom element that accepts generic styles. The plugin allows to change margin, background, font and size of the subtitles.

This plugin was tested with a generic MP4 file with supplied VTT subtitles (except both Windows and Xbox UWP where it can't play this file from the remote server). It can play HLS in Safari (works) and on an Xbox (poor performance).

# Usage

`https://slonopot.github.io/msx-html5xs/html5xs.html?url={URL}`

For example:

```
{
    "type": "pages",
    "headline": "HTML5XS Plugin Test",
    "template": {
        "type": "separate",
        "layout": "0,0,2,4",
        "icon": "msx-white-soft:extension",
        "color": "msx-glass",
        "playerLabel": "Sintel © copyright Blender Foundation | durian.blender.org",
        "action": "video:plugin:https://slonopot.github.io/msx-html5xs/html5xs.html?url=http://msx.benzac.de/media/sintel/sintel.mp4",
        "properties": {
            "resume:position": "102",
            "button:content:icon": "{context:contentIcon}",
            "button:content:action": "{context:contentAction}",
            "html5x:subtitle:en:English": "http://msx.benzac.de/media/sintel/en.vtt"
        }
    },
    "items": [
        {
            "title": "Test",
            "titleFooter": "Whatever",
            "contentIcon": "settings",
            "contentAction": "panel:request:player:options"
        }
    ]
}
```

The rest of the configuration is identical to the original plugin and can be found [here](https://msx.benzac.de/wiki/index.php?title=HTML5X_Plugin).

# Observations

When this plugin was being tested on localhost, the subtitles were loading straight up and the event rewrite was possible on launch. In production, however, the subtitles file is loaded only when selected and launched, it pops into handler with zero cues and I had to bind to `oncuechange` to change individual cue events once they are actually available.

The initial idea was to use this one with HLS streams (little did I know), and HLS stream player will load subtitles gradually which won't allow to add cue events once, this is now done every `oncuechange` which may be affecting performance.

On Xbox (UWP build) with HLS streams `oncuechange` will always have target with 0 or 1 cues, the one that was just loaded. In Safari, however, new cues will be appended to the end and this will allow the plugin to assign event and show items properly.

# Shoutouts

[Media Station X](https://msx.benzac.de/info/)

[The original plugin](https://msx.benzac.de/wiki/index.php?title=HTML5X_Plugin)

[This guy from stackoverflow](https://stackoverflow.com/a/45087610)