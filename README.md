# insomnia-plugin-browser-request

Insomnia plugin to run request in browser

## About

This plugin allows to run request in browser until the callback url is reached.

It's primary intent is to allow the use of the OpenId flow without relying on the OAuth 2.0 Auth Type, in order to implement the requests one by one, but since the Insomnia integrated browser does not allow redirection, I need to run it in the computer's browser instead.

## How To

To install this plugin, first clone it inside the insomnia plugin folder (you can find the location inside insomnia, under Preferences > Plugins > Reveal Plugins Folder).

Once this is done, run the following commands inside this folder :

```sh
npm install

npm run build
```

Voila! If the plugin does not appear to be loaded, do not hesitate to restart Insomnia.