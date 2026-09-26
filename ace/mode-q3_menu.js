ace.define("ace/mode/q3_menu_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules;

    var s = function () {
        // Core structural definitions
        var blocks = "menuDef|itemDef|assetGlobalDef";

        // Layout properties & attributes
        var properties = "name|visible|fullScreen|outOfBoundsClick|rect|focusColor|disableColor|" +
                         "style|border|bordercolor|forecolor|backcolor|decoration|text|type|" +
                         "background|textalign|textalignx|textaligny|textscale|action|mouseEnter|" +
                         "mouseExit|cvarTest|disableCvar|font|smallFont|bigFont|cursor|" +
                         "gradientBar|itemFocusSound|fadeClamp|fadeCycle|fadeAmount|shadowColor|ownerdraw";

        // Script commands executed inside event blocks
        var actions = "open|close|setitemcolor|fadein|fadeout|setcvar|transition|exec";

        // UI Engine constants definitions (e.g. alignment or window styles)
        var constants = "WINDOW_STYLE_FILLED|WINDOW_STYLE_EMPTY|WINDOW_STYLE_SHADER|" +
                        "WINDOW_STYLE_TEAMCOLOR|ALIGN_LEFT|ALIGN_CENTER|ALIGN_RIGHT";

        var keywordMapper = this.createKeywordMapper({
            "storage.type.q3menu": blocks,
            "support.type.property.q3menu": properties,
            "support.function.action.q3menu": actions,
            "support.constant.q3menu": constants
        }, "identifier", true);

        this.$rules = {
            "start": [
                // Single-line comments (handles both engine standard '//' and raw '\\')
                { token: "comment", regex: "(?:\\/\\/|\\\\\\\\).*$" },

                // Double-quoted paths and text values
                { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },

                // C-Preprocessor directives (e.g., #include "ui/menudef.h")
                { token: "keyword.control.directive", regex: "^\\s*#\\s*(?:include|define|undef|if|ifdef|ifndef|else|endif)\\b" },

                // Braces / Layout delimiters
                { token: "paren.lparen", regex: "\\{" },
                { token: "paren.rparen", regex: "\\}" },

                // Numeric configurations (floating, integers, RGBA vector sets)
                { token: "constant.numeric", regex: "\\b-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\b" },

                // Words / Identifiers map against blocks, properties, actions, and constants
                { token: keywordMapper, regex: "\\b[a-zA-Z_][a-zA-Z0-9_]*\\b" }
            ]
        };
        this.normalizeRules();
    };

    r.inherits(s, i);
    t.Q3MenuHighlightRules = s;
});

ace.define("ace/mode/q3_menu", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_menu_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_menu_highlight_rules").Q3MenuHighlightRules;

    var o = function () {
        this.HighlightRules = s;
        this.$behaviour = this.$defaultBehaviour;
    };

    r.inherits(o, i);

    (function () {
        this.lineCommentStart = ["//", "\\\\"];
        this.$id = "ace/mode/q3_menu";
    }).call(o.prototype);

    t.Mode = o;
});

(function () {
    ace.require(["ace/mode/q3_menu"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();