(function(){

    let content = `
        <div id="listContainer" style="display:none">
            <div id="controlsBar">
                <a href="#" id="exitButton"><img src="${staticLink("img/logout.png")}" alt="Выход"></a>
                <input type="button" id="jumpButton" value="Создать группу">
            </div>
            <div id="jumpList"></div>
            <div id="userList"></div>
        </div>
    
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
                <input type="text" title="motto" id="s_mottoInput" onclick="this.select();">
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
    wrap.id = "wrap";
    wrap.innerHTML = content;
    document.body.appendChild(wrap);
    
    window.GVD_run();
})();