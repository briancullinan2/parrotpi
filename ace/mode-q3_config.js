ace.define("ace/mode/q3_config_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            this.$rules = {
                "start": [
                    // Single-line engine comments
                    { token: "comment", regex: "\\/\/.*$" },

                    // Quoted strings/values/commands
                    { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },

                    // Structural Assignments: seta / set / sets cvar_name
                    // Added () around \\s+ so it maps perfectly to the "text" token
                    {
                        token: ["keyword.control", "text", "support.variable"],
                        regex: "\\b(seta|set|sets)(\\s+)([a-zA-Z0-9_]+)"
                    },

                    // Structural Keybinds: bind KEYNAME
                    // Added () around \\s+ so it maps perfectly to the "text" token
                    {
                        token: ["keyword.control", "text", "variable.language"],
                        regex: "\\b(bind)(\\s+)(\\S+)"
                    },

                    // Standalone Console Commands
                    { 
                        token: "keyword.control", 
                        regex: "\\b(?:unbindall|unbind|exec|vstr|echo|say|say_team|toggle|vid_restart|snd_restart)\\b" 
                    },

                    // Command Separator (Semicolons chain multiple Q3 commands)
                    { token: "punctuation.separator", regex: ";" },

                    // Numeric values (floating boundaries, integers, negatives)
                    { token: "constant.numeric", regex: "\\b-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\b" }
                ]
            };
        };
    r.inherits(s, i), t.Q3ConfigHighlightRules = s;
});

ace.define("ace/mode/q3_config", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_config_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_config_highlight_rules").Q3ConfigHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = "//";
        this.$id = "ace/mode/q3_config";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    ace.require(["ace/mode/q3_config"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();