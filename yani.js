(function () {
    'use strict';

    var network = new Lampa.Reguest();
    var API = 'https://api.yani.tv';

    function request(url, params, success, error) {
        network.native(url, success, error, params || {}, {
            timeout: 10000,
            dataType: 'json',
            headers: {
                'Accept': 'image/avif,image/webp'
            }
        });
    }

    Lampa.Online.add({
        id: 'yummyanime',
        title: 'YummyAnime',
        enabled: true,

        search: function (query, callback) {
            request(API + '/anime', { search: query, limit: 10 }, function (res) {
                if (!res || !res.response) return callback([]);

                callback(res.response.map(function (a) {
                    return {
                        id: a.anime_id,
                        title: a.title,
                        year: a.year,
                        img: a.poster?.medium,
                        type: 'anime'
                    };
                }));
            }, function () {
                callback([]);
            });
        },

        get: function (item, callback) {
            request(API + '/anime/' + item.id, {}, function (res) {
                if (!res || !res.videos) return callback([]);

                callback([{
                    season: 1,
                    episodes: res.videos.map(function (v, i) {
                        return {
                            id: v.video_id,
                            title: v.number || (i + 1),
                            episode: i + 1,
                            season: 1
                        };
                    })
                }]);
            }, function () {
                callback([]);
            });
        },

        play: function (item, episode, callback) {
            callback({
                url: episode.iframe_url,
                quality: 'auto'
            });
        }
    });

})();
