/*----------------------------------------------------*/
/* Global Params:
------------------------------------------------------ */
const VERBOSE = true;
const CONST_LOST_COM_TIMEOUT_100MS = 50; // 5 [s]
// const CONST_ELEKTRA_JSON_URL = "http://192.168.0.227:8000";//"/elektra.json";
const CONST_ELEKTRA_JSON_URL = "http://192.168.4.1/elektra.txt";

/*----------------------------------------------------*/
/* Global Placeholder:
------------------------------------------------------ */
var APP_TICKS_100MS             = 0;
var APP_ELEKTRA_JSON_DATA       = {};
var APP_ELEKTRA_LAST_COM_TS     = 0;

var BREW_PROFILE = {
    "pre-infusion": 8,
    "brewing-target": 38,
    "brewing-max": 60,
    "brewing-stop-counter-at": 100,
}
var ELEKRTA_STATUS = {
    "#elektra-status-warn-faulty_boiler": false,
    "#elektra-status-warn-faulty_group" : false,
    "#elektra-status-warn-no_water"     : false,
    "#elektra-status-off"               : false,
    "#elektra-status-idle"              : false,
    "#elektra-status-heating"           : false,
    "#elektra-status-ready"             : false,
}
var ELEKRTA_BREWING_STATUS = {
    "#elektra-status-online-offline"     : false,
    "#elektra-status-online-ready"       : false,
    "#elektra-status-online-pre-infusion": false,
    "#elektra-status-online-brewing"     : false,
}

var ELEKTRA_BREW_STATS = {
    "_cups"              : 0,
    "_temp_c"            : 0,
    "_set_temp_c"        : 0,
    "_t_preinf_s_set"    : 0,
    "_t_preinf_s"        : 0,
    "_t_group_s"         : 0,
    "_running"           : false,
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
        // request updates:
        app_acquire_data_100ms();

        // update app:
        app_update_100ms();

        // increment counter
        APP_TICKS_100MS ++;
    },100);
}


function app_update_100ms() {
    // acquire time:
    time_now_ts = Date.now()
    
    // process previous data:
    elektra_alarmed = app_process_ELEKTRA_100ms(time_now_ts);
    
    // transition:
    if (ELEKRTA_BREWING_STATUS["#elektra-status-online-ready"] || ELEKRTA_BREWING_STATUS["#elektra-status-online-offline"])
    {
        // Permit user-UI actions:
        user_action = app_process_user_action_100ms(time_now_ts);
        // Sync date and time:
        app_process_check_and_sync_date_time_100ms();
    }
    else
    {
        console_print("System Offline!");
    }

    // update UI:
    if (APP_ELEKTRA_JSON_DATA)
    {
        app_render_UI(time_now_ts);
    }
}

function app_update_progress_bar_100ms(time_now_ts, prev_time_ts, brew_profile) {
    const color1 = '#3E8EF7';
    const color2 = '#EC407A';

    // - compute:
    // time_now_ts = Date.now()
    delta_time_ms = time_now_ts - prev_time_ts
    MAX_BREW = brew_profile["brewing-max"]
    PRE_BREW = brew_profile["pre-infusion"]
    TARGET_BREW = brew_profile["brewing-target"]
    LIMIT = brew_profile["brewing-stop-counter-at"]

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
    _status = APP_ELEKTRA_JSON_DATA.STATUS_FLAGS;

    // catch:
    IS_ALARM_FAULTY_GROUP = checkBit(_status, 4);
    IS_ALARM_FAULTY_BOILER = checkBit(_status, 5);
    IS_ALARM_NO_WATER = checkBit(_status, 8);
    IS_ALARM_BATTERY = checkBit(_status, 3);
    IS_ALARMED = IS_ALARM_FAULTY_GROUP | IS_ALARM_FAULTY_BOILER | IS_ALARM_NO_WATER;
    
    IS_RUNNING = checkBit(_status, 0);
    IS_SLEEPING = checkBit(_status, 2);
    IS_HEATING = checkBit(_status, 1);
    IS_READY = checkBit(_status, 6);
    IS_IDLE_NOT_HEATED = checkBit(_status, 7);

    if (IS_ALARM_BATTERY)
    {console_print("[ALARM]: Battery Issue???")} // not sure exactly what this is
    // cache:
    ELEKRTA_STATUS["#elektra-status-warn-faulty_boiler"] = IS_ALARM_FAULTY_BOILER;
    ELEKRTA_STATUS["#elektra-status-warn-faulty_group" ] = IS_ALARM_FAULTY_GROUP;
    ELEKRTA_STATUS["#elektra-status-warn-no_water"     ] = IS_ALARM_NO_WATER;
    ELEKRTA_STATUS["#elektra-status-off"               ] = IS_SLEEPING;
    ELEKRTA_STATUS["#elektra-status-idle"              ] = IS_IDLE_NOT_HEATED;
    ELEKRTA_STATUS["#elektra-status-heating"           ] = IS_HEATING;
    ELEKRTA_STATUS["#elektra-status-ready"             ] = IS_READY;

    ELEKRTA_BREWING_STATUS["#elektra-status-online-offline"     ] = IS_SLEEPING;
    ELEKRTA_BREWING_STATUS["#elektra-status-online-ready"       ] = IS_READY;

    for (var i in ELEKRTA_STATUS)
        console_print([i, ELEKRTA_STATUS[i]]);
    // brew Profile:
    BREW_PROFILE["pre-infusion"] = APP_ELEKTRA_JSON_DATA.SET_SECS_PREINF;

    // cache:
    ELEKTRA_BREW_STATS["_running"] = IS_RUNNING;
    ELEKTRA_BREW_STATS["_cups"] = APP_ELEKTRA_JSON_DATA.CUPS_COUNTERS;
    ELEKTRA_BREW_STATS["_temp_c"] = APP_ELEKTRA_JSON_DATA.TEMP_GROUP;
    ELEKTRA_BREW_STATS["_set_temp_c"] = APP_ELEKTRA_JSON_DATA.SET_TEMP_GROUP;
    ELEKTRA_BREW_STATS["_t_preinf_s_set"] = APP_ELEKTRA_JSON_DATA.SET_SECS_PREINF;
    ELEKTRA_BREW_STATS["_t_preinf_s"] = APP_ELEKTRA_JSON_DATA.SECS_PREINF;
    ELEKTRA_BREW_STATS["_t_group_s"] = APP_ELEKTRA_JSON_DATA.SECS_DISTRIBUTION;

    return IS_ALARMED;
}

function app_process_user_action_100ms(time_now_ts){

}

prev_time_ts = 0
time_new_now_ts = 0
function app_render_UI(time_now_ts){
    // cache numbers
    _cups = ELEKTRA_BREW_STATS["_cups"];
    _temp_c = ELEKTRA_BREW_STATS["_temp_c"];
    _set_temp_c = ELEKTRA_BREW_STATS["_set_temp_c"];
    _t_preinf_s_set = ELEKTRA_BREW_STATS["_t_preinf_s_set"];
    _t_preinf_s = ELEKTRA_BREW_STATS["_t_preinf_s"];
    _t_group_s = ELEKTRA_BREW_STATS["_t_group_s"];

    // update string
    $("#live-cup-counter").attr("data-label", _cups);
    $("#live-temperature-c").attr("data-label", formatTemp(_temp_c)+"C");
    $("#live-temperature-f").attr("data-label", "("+formatTemp(convertToF(_temp_c))+"F)");
    $("#live-set-temperature-c").attr("data-label", formatTemp(_set_temp_c)+"C");
    $("#live-set-temperature-f").attr("data-label", "("+formatTemp(convertToF(_set_temp_c))+"F)");
    $("#live-timer-preinf-set").attr("data-label", _t_preinf_s_set +" s");
    $("#live-timer-preinf").attr("data-label", _t_preinf_s +" s");
    $("#live-timer-group").attr("data-label", _t_group_s +" s");

    // render progress //FIXME: please fix the latency issue??
    _in_progress = (((time_new_now_ts-prev_time_ts)/1000 - _t_group_s) <= 1)
    if (_t_group_s == 0)
        prev_time_ts = time_now_ts - 1000
    if (ELEKTRA_BREW_STATS["_running"] && _in_progress)
    {
        time_new_now_ts = time_now_ts
        if ((time_new_now_ts-prev_time_ts)/1000 < _t_preinf_s)
        {
            ELEKRTA_BREWING_STATUS["#elektra-status-online-pre-infusion"] = true
            ELEKRTA_BREWING_STATUS["#elektra-status-online-brewing"     ] = false
        }
        else
        {
            ELEKRTA_BREWING_STATUS["#elektra-status-online-pre-infusion"] = false
            ELEKRTA_BREWING_STATUS["#elektra-status-online-brewing"     ] = true
        }
    }
    
    if (_in_progress)
        app_update_progress_bar_100ms(time_new_now_ts, prev_time_ts, BREW_PROFILE);

    //  ### Machine Status ###
    for (var id in ELEKRTA_STATUS)
    {
        if (ELEKRTA_STATUS[id])
            $(id).removeClass("hidden");
        else
            $(id).addClass("hidden");
    }
    // ### Pre-infusion Monitor ###
    for (var id in ELEKRTA_BREWING_STATUS)
    {
        if (ELEKRTA_BREWING_STATUS[id])
            $(id).removeClass("hidden");
        else
            $(id).addClass("hidden");
    }

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
    if(APP_ELEKTRA_JSON_DATA.TIME !== time) {
        write_reg(16, time, () => {
            if(date !== APP_ELEKTRA_JSON_DATA.DATE) {
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