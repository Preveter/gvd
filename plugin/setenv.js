(function(){

    window.staticLink = function(link){
        return chrome.extension.getURL("" + link);
    };

    window.notify = function(msg, options){
        try {
            let n = new Notification(msg, options);
            n.onclick = () => {
                try { window.focus(); }
                catch (ex) {}
            };
        }catch (ex) {
            console.log("Exception " + ex.name + ": " + ex.message);
        }
    };

})();
