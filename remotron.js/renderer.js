const {spawn} = require("child_process");
const fs = require("fs");

const ZMQ_CONTEXT = require("zeromq")
const IPC_RECV = new ZMQ_CONTEXT.Pull
const IPC_SEND = new ZMQ_CONTEXT.Push

// track opened tab num
let tab_num = 1

let SESSIONS = null

function send_msg(key, value=null) {
    const client_msg_json = {
        [key]: value
    }
    IPC_SEND.send(JSON.stringify(client_msg_json)).then()
}


const TERM = new Terminal();
TERM.open(document.getElementById('terminal'));
TERM.onKey(async (e) => {
    const ev = e.domEvent;
    send_msg("send", {
        "s": "EECG1",
        "d": e.key
    })
});

function printLog(text) {
    const log_elem = document.getElementById("logs")
    const now = new Date()
    text = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + ": " + text + "\n"
    if (log_elem) log_elem.innerText += text
}

function handle_sessions(value) {
    // TODO: integrated with GUI
    // printLog(`handle_sessions: ${JSON.stringify(value, null, ' ')}`)
    SESSIONS = value
}

function handle_login_ack(value){
    alert("Login: " + value)
}

function handle_recv(value){
    TERM.write(atob(value["d"]))
}

function handle_terminal(value){
    // TODO: should add a parameter to allow reuse of this function for different terminals
    TERM.write(atob(value))
}

function handle_main(key, value) {
    if (key === "sessions") {
        handle_sessions(value)
    }
    else if (key === "login_ack"){
        handle_login_ack(value)
    }
    else if (key === "recv"){
        handle_recv(value)
    }
    else {
        printLog(`handle_main: Unknown key=${key}, value=${value}`)
        return false
    }

    return true
}

async function listen() {
    let running = true;
    while (running) {
        let recv_data = await IPC_RECV.receive()
        recv_data = recv_data.toString("utf-8")
        // printLog(recv_data)
        const recv_parsed = JSON.parse(recv_data)
        for (const key in recv_parsed) {
            if (!handle_main(key, recv_parsed[key])) {
                running = false
                break
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    IPC_RECV.bind("tcp://*:8001").then(r => {
            printLog("Binding successful")

            const PyMotron = spawn(
                "../PyMotron/venv/bin/python3",
                [
                    "-u",
                    "../PyMotron/PyMotron.py",
                    8000,
                    8001
                ],
                {
                    cwd: "../PyMotron"
                });

            PyMotron.stdout.on("data", data => {
                printLog(`\nPyMotron stdout:\n ---\n ${data}---`);
            });

            PyMotron.stderr.on("data", data => {
                printLog(`\nPyMotron stderr:\n ---\n ${data}---`);
            });

            PyMotron.on('error', (error) => {
                printLog(`\nPyMotron error: ${error.message}`);
            });

            PyMotron.on("close", code => {
                printLog(`\nPyMotron exited with code ${code}`);
            });

            IPC_SEND.connect("tcp://127.0.0.1:8000")

            send_msg("sync")

            listen().then()
        }
    )
})

function debug_submit() {
    const debug_key = document.getElementById("debug_key")
    const debug_value = document.getElementById("debug_value")

    const debug_value_JSON = (debug_value.value === "")?null:JSON.parse(debug_value.value)

    send_msg(debug_key.value, debug_value_JSON)

    return false
}

function add_new_tab() {
    console.log("new tab")
    const tab_bar = document.getElementById("tab_bar")
    const add_button = document.getElementById("add_button")
    // create a new tab link (full link = link itself + delete icon)
    // create a full table link
    const new_full_tab_link = document.createElement("div")
    new_full_tab_link.setAttribute("class", "ui left labeled button tab_link")
    new_full_tab_link.setAttribute("tab_index", "0")
    new_full_tab_link.setAttribute("id", "tab_link_"+(++tab_num))
    // create link itsef
    const new_tab_link = document.createElement("a")
    new_tab_link.setAttribute("class", "ui basic label")
    new_tab_link.setAttribute("onclick", "show_current_tab(this)")
    new_tab_link.innerHTML = "New Tab"
    // create delete icon
    const new_link_delete_icon = document.createElement("div")
    new_link_delete_icon.setAttribute("class", "ui icon button")
    new_link_delete_icon.setAttribute("onclick", "delete_current_tab(this)")
    new_link_delete_icon.innerHTML = "<i class='delete icon'></i>"
    new_full_tab_link.appendChild(new_tab_link)
    new_full_tab_link.appendChild(new_link_delete_icon)
    tab_bar.insertBefore(new_full_tab_link, add_button)
    // create a new tab content
    const new_tab_content = document.createElement("div")
    new_tab_content.setAttribute("class", "ui cards tab_content")
    new_tab_content.setAttribute("id", "tab_content_"+tab_num)
    // read from local user profile json file
    const user_profile_json = fs.readFileSync("../PyMotron/profile/user_profile.json")
    const user_profile = JSON.parse(user_profile_json)
    const sessions = user_profile["sessions"]
    // generate user profile card
    for (const session in sessions) {
        const card_html = "<div class='card'><div class='content'><div class='header'>" + session + "</div><div class='meta'>" + 
        sessions[session].conn_profile + "</div><div class='description'>" + sessions[session].last_server + "</div></div><div class='extra content'>" + 
        "<div class='ui two buttons'><div class='ui basic green button'>Connect</div><div class='ui basic red button'>Edit</div></div></div></div>"
        new_tab_content.innerHTML += card_html
    }
    tab_bar.insertAdjacentElement("afterend", new_tab_content)
    show_current_tab(new_tab_link)
}

function show_current_tab(tab_link) {
    // get tab num
    const tab_id = tab_link.parentNode.id
    console.log("show tab link id: "  + tab_id)
    const cur_tab_num = tab_id.match(/(\d+)/)[0];
    for(let i = 1; i <= tab_num; i++) {
        const tab_link = document.getElementById("tab_link_"+i)
        const tab_content = document.getElementById("tab_content_"+i)
        if (i != cur_tab_num) {
            // unhighlight tab
            if (typeof(tab_link) != 'undefined' && tab_link != null) {
                tab_link.childNodes[0].classList.remove("blue")
            }
            // disable view for other tabs
            if (typeof(tab_content) != 'undefined' && tab_content != null) {
                tab_content.style.display = "none";
            }
        } else {
            // highlight current tab
            if (typeof(tab_link) != 'undefined' && tab_link != null) {
                tab_link.childNodes[0].classList.add("blue")
            }
            // show the conntent of current tab
            if (typeof(tab_content) != 'undefined' && tab_content != null) {
                tab_content.style.display = "block";
            }
            
        }
    }
}

function delete_current_tab(tab_link) {
    console.log("delete")
    // get tab num
    const tab_id = tab_link.parentNode.id
    const cur_tab_num = tab_id.match(/(\d+)/)[0];
    console.log("delete tab link id: "  + cur_tab_num)
    const tab_link_delete = document.getElementById("tab_link_" + cur_tab_num)
    const tab_content_delete = document.getElementById("tab_content_" + cur_tab_num)
    // remove the tab link and content
    tab_link_delete.parentElement.removeChild(tab_link_delete)
    tab_content_delete.parentElement.removeChild(tab_content_delete)
    // show the last available tab
    let last_avail_tab_num = 0;
    for(let i = 1; i <= tab_num; i++) {
        const tab_link_avail = document.getElementById("tab_link_"+i)
        if (typeof(tab_link_avail) != 'undefined' && tab_link_avail != null) {
            last_avail_tab_num = i;
        }
    }
    console.log("avail tab: " + last_avail_tab_num)
    if (last_avail_tab_num != 0) {
        const avail_tab = document.getElementById("tab_link_"+last_avail_tab_num)
        show_current_tab(avail_tab.childNodes[0])
    }
}
