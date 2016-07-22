(function(){

    window.staticLink = function(link){
        return "static/" + link;
    };

    navigator.serviceWorker.register('sw.js');

    window.notify = function(msg, options){
        navigator.serviceWorker.ready
            .then( registration => {
                registration.showNotification(msg, options);
            });
    };

})();
