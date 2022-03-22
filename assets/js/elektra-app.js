/*----------------------------------------------------*/
/* Global Params:
------------------------------------------------------ */
const VERBOSE = true;
const CONST_LOST_COM_TIMEOUT_100MS = 50; // 5 [s]
const CONST_ELEKTRA_JSON_URL = "../../../elektra.json"
/*----------------------------------------------------*/
/* Global Placeholder:
------------------------------------------------------ */
var APP_TICKS_100MS             = 0;
var APP_ELEKTRA_JSON_DATA       = {};
var APP_ELEKTRA_LAST_COM_100MS  = 0;

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
    // console_print(APP_TICKS_100MS);
    app_acquire_data_100ms();
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