(function(){

    let content = `
        <div id="gvdContainer" style="display:none">
            <div id="controlsBar">
                <a href="#" id="exitButton"><img src="${staticLink("img/logout.png")}" alt="Выход"></a>
                <input type="button" id="jumpButton" value="Создать группу">
            </div>
            <div id="viewContainer"></div>
            <div id="jumpList"></div>
            <div id="userList"></div>
        </div>
        
        <!--<div id="jumpContainer">
            <div id="jumpOwner"></div>
            <div id="jumpTimer"></div>
            <div id="jumpMembers"></div>
            <div id="jumpChat">
                <div class="chat"></div>
                <div class="chatForm">
                    <input type="text" id="chatInput">
                    <input type="button" value="Send" id="chatSend">
                </div>
            </div>
        </div>-->
    
        <div id="loginContainer" style="display:none">
            <div id="loginForm" class="authForm" style="display:none">
                <label for="nameInput">Имя бога:</label>
                <input type="text" title="login" id="nameInput" value="">
                <label for="passInput">Пароль:</label>
                <input type="password" title="password" id="passInput" value="">
                <div class="buttonContainer">
                    <input type="button" id="confirmButton" value="Войти">
                    <input type="button" id="signupButton" value="Регистрация">
                </div>
            </div>
        </div>
    
        <div id="signupContainer" class="authForm" style="display:none">
            <div id="signupForm1" style="display:none">
                <label for="s_nameInput">Ваш логин в Годвилле:</label>
                <input type="text" title="login" id="s_nameInput" value="">
            </div>
            <div id="signupForm2" style="display:none">
                <label for="s_mottoInput">Вставьте в любое место вашего девиза следующую строку:</label>
                <input type="text" title="motto" id="s_mottoInput" readonly>
            </div>
            <div id="signupForm3" style="display:none">
                <label for="s_passInput">Придумайте и введите пароль:</label>
                <input type="password" title="password" id="s_passInput" value="">
            </div>
            <div class="buttonContainer">
                <input type="button" id="signupProceed" value="Далее">
            </div>
        </div>
    `;

    let wrap = document.createElement("div");
    wrap.id = "gvd_wrap";
    wrap.innerHTML = content;
    document.body.appendChild(wrap);

    let container = document.getElementsByClassName("msgDockWrapper")[0];
    if (typeof container != "undefined"){

        let btn = document.createElement("div");
        btn.id = "gvdButton";
        btn.className = "msgDock";
        btn.innerHTML = "GVD";

        btn.onclick = () => {
            if (wrap.className != "hidden") wrap.className = "hidden";
            else wrap.className = "";
        };

        wrap.className = "hidden";
        // TODO: Do not hide if login is needed
        
        container.appendChild(btn);
    }

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