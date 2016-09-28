(function(){

    let wrap = document.createElement("div");
    wrap.id = "gvd_wrap";
    wrap.innerHTML = '<div id="gvdContainer"></div>';
    document.body.appendChild(wrap);

    /*let liveLink = document.getElementById("fbclink");
    if (liveLink && liveLink.href != ""){
        let p = liveLink.href.lastIndexOf("/");
        if (~p){
            let id = liveLink.href.substr(p);
            window.GVD_chat_init();
        }
    }else*/
    if (document.getElementById("page_settings_link")) window.GVD_run();

})();