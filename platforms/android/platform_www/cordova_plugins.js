cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "id": "cordova-plugin-background-fetch.BackgroundFetch",
        "file": "plugins/cordova-plugin-background-fetch/www/BackgroundFetch.js",
        "pluginId": "cordova-plugin-background-fetch",
        "clobbers": [
            "window.BackgroundFetch"
        ]
    },
    {
        "id": "cordova-background-geolocation-lt.BackgroundGeolocation",
        "file": "plugins/cordova-background-geolocation-lt/www/BackgroundGeolocation.js",
        "pluginId": "cordova-background-geolocation-lt",
        "clobbers": [
            "window.BackgroundGeolocation"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "cordova-plugin-whitelist": "1.3.2",
    "cordova-plugin-background-fetch": "5.0.0",
    "cordova-background-geolocation-lt": "2.8.3"
};
// BOTTOM OF METADATA
});