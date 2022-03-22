/*----------------------------------------------------*/
/* Global Params:
------------------------------------------------------ */
const VERBOSE = true;
const CONST_LOST_COM_TIMEOUT_100MS = 50; // 5 [s]
const CONST_ELEKTRA_JSON_URL = "http://192.168.0.227:8000";//"/elektra.json";

/*----------------------------------------------------*/
/* Global Placeholder:
------------------------------------------------------ */
var APP_TICKS_100MS             = 0;
var APP_ELEKTRA_JSON_DATA       = {};
var APP_ELEKTRA_LAST_COM_100MS  = 0;
var APP_TIMER_PROGRESS_TS       = Date.now();

var BREW_PROFILE = {
    "pre-infusion": 8,
    "brewing-target": 38,
    "brewing-max": 60,
    "brewing-stop-counter-at": 100,
}
/*----------------------------------------------------*/
/* Const Intv Thread
------------------------------------------------------ */
// - compute at load
$(document).ready(startEngine);

// ----- Core Animation Code
function startEngine() {
    // Init:
    APP_TICKS_100MS = 0;
    APP_ELEKTRA_LAST_COM_TS = Date.now();
    console_print("Program Begins");

    // Const update:
    var FrameTimer = setInterval(function(){
        
        app_update_100ms();
        
        APP_TICKS_100MS ++;
    },100);
}


function app_update_100ms() {
    // input:
    app_acquire_data_100ms();
    // user-UI actions:
    app_process_user_action_100ms();
    
    // transition:
    
    // action:
    app_update_progress_bar_100ms();
}

function app_update_progress_bar_100ms() {
    const color1 = '#3E8EF7';
    const color2 = '#EC407A';

    // - compute:
    time_now_ts = Date.now()
    delta_time_ms = time_now_ts - APP_TIMER_PROGRESS_TS
    MAX_BREW = BREW_PROFILE["brewing-max"]
    PRE_BREW = BREW_PROFILE["pre-infusion"]
    TARGET_BREW = BREW_PROFILE["brewing-target"]
    LIMIT = BREW_PROFILE["brewing-stop-counter-at"]

    if (delta_time_ms > LIMIT * 1000)
        return false

    percentage = Math.min(delta_time_ms/10/MAX_BREW, 100);
    percentage_pre = Math.min(PRE_BREW*100/MAX_BREW, 100);
    percentage_brew = Math.min(TARGET_BREW*100/MAX_BREW, 100);
    text = (delta_time_ms/1000).toFixed(1) + ' s'
    text_pre = (PRE_BREW).toFixed(1) + ' s'
    text_brew = (TARGET_BREW).toFixed(1) + ' s'

    // - update:
    $(".elektra-progress-bar").css('--progress-bar', percentage.toString());
    $(".elektra-progress-bar").css('--indicator-location-pre-infusion', percentage_pre.toString());
    $(".elektra-progress-bar").css('--indicator-location-brewing', percentage_brew.toString());
    $("#live-brewing-timer").attr("data-label", text);
    $("#brew-time-pre-infusion").attr("data-label", text_pre);
    $("#brew-time-brewing").attr("data-label", text_brew);
    
    if (percentage < percentage_pre) {
        $(".elektra-progress-bar").css('--bar-color', color1);
        $(".elektra-progress-bar").css('--color-pre-infusion', "#ced4da");
        $(".elektra-progress-bar").css('--color-brewing', "#ced4da");
    }
    else if (percentage < percentage_brew) {
        var ratio = 0.5;
        var hex = function(x) {
            x = x.toString(16);
            return (x.length == 1) ? '0' + x : x;
        };
        
        var ratio = (percentage - percentage_pre)/(percentage_brew - percentage_pre);
        var r = Math.ceil(parseInt(color2.substring(1,3), 16) * ratio + parseInt(color1.substring(1,3), 16) * (1-ratio));
        var g = Math.ceil(parseInt(color2.substring(3,5), 16) * ratio + parseInt(color1.substring(3,5), 16) * (1-ratio));
        var b = Math.ceil(parseInt(color2.substring(5,7), 16) * ratio + parseInt(color1.substring(5,7), 16) * (1-ratio));
        
        var middle = hex(r) + hex(g) + hex(b);
        $(".elektra-progress-bar").css('--bar-color', "#"+middle);
        $(".elektra-progress-bar").css('--color-pre-infusion', color1);
    }
    else {
        $(".elektra-progress-bar").css('--bar-color', color2);
        $(".elektra-progress-bar").css('--color-brewing', color2);
    }

    return true
}

function app_process_user_action_100ms(){
    // APP_TIMER_PROGRESS_TS = time_now_ts
}

function app_acquire_data_100ms() {
    $.ajax({
        url: CONST_ELEKTRA_JSON_URL, dataType: 'json', 
        success: function (result) {
            APP_ELEKTRA_LAST_COM_100MS = APP_TICKS_100MS;
            APP_ELEKTRA_JSON_DATA = result;
        },
        error: (request, error) => {
            // console.log('error:' + error);
            // do-nothing
        }
    });
}


/*----------------------------------------------------*/
/* Helper:
------------------------------------------------------ */
function console_print(content) {
    if (VERBOSE)
        console.log("[Elektra-APP] > "+ content);
}