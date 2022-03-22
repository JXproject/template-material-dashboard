/*----------------------------------------------------*/
/* Global Params:
------------------------------------------------------ */
const VERBOSE = true;
const CONST_LOST_COM_TIMEOUT_100MS = 50; // 5 [s]
const CONST_ELEKTRA_JSON_URL = "http://192.168.0.227:8000";//"/elektra.json";

const ELEKTRA_STATUS_RUNNING  = Symbol("running")
const ELEKTRA_STATUS_SLEEPING = Symbol("in-sleep")
const ELEKTRA_STATUS_IDLE     = Symbol("idling")
const ELEKTRA_STATUS_HEATING  = Symbol("heating")
/*----------------------------------------------------*/
/* Global Placeholder:
------------------------------------------------------ */
var APP_TICKS_100MS             = 0;
var APP_ELEKTRA_JSON_DATA       = {};
var APP_ELEKTRA_LAST_COM_TS     = 0;
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
        // update app:
        app_update_100ms();

        // request updates:
        app_acquire_data_100ms();

        // increment counter
        APP_TICKS_100MS ++;
    },100);
}


function app_update_100ms() {
    // acquire time:
    time_now_ts = Date.now()
    
    // process previous data:
    elektra_status = app_process_ELEKTRA_100ms(time_now_ts);
    
    // transition:
    switch (elektra_status) {
        case ELEKTRA_STATUS_RUNNING:
            // report progress:
            app_update_progress_bar_100ms(time_now_ts);
            break;
        case ELEKTRA_STATUS_IDLE:
        case ELEKTRA_STATUS_HEATING:
        case ELEKTRA_STATUS_SLEEPING:
        default:
            // Permit user-UI actions:
            user_action = app_process_user_action_100ms(time_now_ts);
            // Sync date and time:
            app_process_check_and_sync_date_time_100ms();
            break;
    }

}

function app_update_progress_bar_100ms(time_now_ts) {
    const color1 = '#3E8EF7';
    const color2 = '#EC407A';

    // - compute:
    // time_now_ts = Date.now()
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


function app_process_ELEKTRA_100ms(time_now_ts) {

    // We will be processing ELEKTRA status feedback here:
    // APP_ELEKTRA_LAST_COM_TS
    // APP_ELEKTRA_JSON_DATA

    APP_TIMER_PROGRESS_TS = time_now_ts



    return ELEKTRA_STATUS_RUNNING;
}

function app_process_user_action_100ms(time_now_ts){
}

function app_acquire_data_100ms() {
    $.ajax({
        url: CONST_ELEKTRA_JSON_URL, dataType: 'json', 
        success: function (result) {
            APP_ELEKTRA_LAST_COM_TS = Date.now();
            APP_ELEKTRA_JSON_DATA = result;
        },
        error: (request, error) => {
            // console.log('error:' + error);
            // do-nothing
        }
    });
}

function app_process_check_and_sync_date_time_100ms(){
    var now = new Date();
    // console.log(now.getHours(), now.getMinutes(), now.getDate(), now.getMonth(), now.getFullYear());
    var time = ((now.getHours() & 0xFF) << 8) | (now.getMinutes() & 0xFF);
    var date = (now.getDate() & 0x1F) | ((now.getMonth() + 1 & 0x0F) << 5) | (((now.getFullYear() - 2000) & 0x7F) << 9)
    if(JSONData.TIME !== time) {
        write_reg(16, time, () => {
            if(date !== JSONData.DATE) {
                write_reg(17, date, () => {})
            }
        })
    }
}

/*----------------------------------------------------*/
/* Helper:
------------------------------------------------------ */
function console_print(content) {
    if (VERBOSE)
        console.log("[Elektra-APP] > "+ content);
}


/*----------------------------------------------------*/
/* Elektra Verve Helper:
------------------------------------------------------ */
function formatTemp(value) {
    return `${value}°`;
}

function convertToF(celsius) {
    return Math.round(celsius * 9/5 + 32);
}

function pos(parent, obj, x, y, width, height)
{
    const w = width || STAGE_WIDTH;
    const h = height || STAGE_HEIGHT;
    if(obj.getBounds())  {
        obj.regX = obj.getBounds().width / 2;
        obj.regY = obj.getBounds().height / 2;
    }
    else {
        obj.regX = obj.getMeasuredWidth() / 2;
        obj.regY = obj.getMeasuredHeight() / 2;
    }
    obj.x = w * x;
    obj.y = h * y;
    obj.scale = BMP_DEFAULT_SCALE;
    parent.addChild(obj);
}

function checkBit(value, pos) {
    return ((value) & (1<<(pos)))
}

function setBit(value, pos) {
    return ((value) | (1<<(pos)))
}

function resetBit(value, pos) {
    return ((value) & ~(1<<(pos)))
}

function toggleBit(value, pos) {
    return ((value) ^ (1<<(pos)))
}

function pad(value, length, type) {
    const padding = type || '0';
    return (value.toString().length < length) ? pad(padding + value, length, type) : value;
}

function padTemp(val) {
    // return pad(val, 3, ' ');
    return val;
}

function padTime(val) {
    // return pad(val, 3, ' ');
    return val;
}

function write_reg(addr, value, cb) {
    console.log("write_reg:", addr, "value:", value);
    $.ajax({
        url: "/web.cgi?elektra_write=" + addr + "|" + value,
        success: function (res) {
            cb(null, res);
        },
        error: function(err) {
            cb(err, null);
        }
    });
}