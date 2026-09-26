ace.define("ace/mode/wasm_disassembly_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            this.$rules = {
                start: [
                    // Dividers and Structural Headers
                    { token: "punctuation.definition.comment", regex: "^[=-]{10,}$" },
                    { token: "comment.heading", regex: "^[A-Z0-9]{2,}.*$" },
                    
                    // Core Map Target Labels & System Variables
                    { token: "support.variable", regex: "^[A-Za-z0-9_ ]+:(?=\\s)" },
                    { token: "support.type", regex: "^[A-Za-z0-9_ ]+(?=\\s(?:size|profile|Bounds|Matrix|Assertions|Accessors):)" },
                    
                    // Hex Memory Offsets at start of lines
                    { token: "constant.numeric", regex: "\\b0x[0-9A-Fa-f]+:" },
                    
                    // Text representation column dump context: | .... |
                    { token: "string.inline", regex: "\\|[^|]*\\|" },
                    
                    // Link and Export interface components
                    { token: "keyword.operator", regex: "(?:->|=>)" },
                    { token: "storage.modifier", regex: "\\b(?:link|export|Index|Global|Fn|Mem)\\b" },
                    
                    // Intercept ASM Array Blocks and transition rule states
                    { token: "comment.line", regex: "; ASM: \\x5b", next: "wasm_asm" }
                ],
                wasm_asm: [
                    // Pop back to baseline state when array boundary closes
                    { token: "comment.line", regex: "\\x5d", next: "start" },
                    
                    // Comprehensive WebAssembly Opcode Dictionary Matrix
                    { 
                        token: "keyword", 
                        regex: "\\b(?:global\\.(?:get|set)|local\\.(?:tee|set|get)|" +
                               "i32\\.(?:load(?:8_s|8_u|16_s|16_u)?|store(?:8|16)?|const|eqz|eq|ne|lt_s|lt_u|gt_s|gt_u|le_s|le_u|add|sub|mul|div_s|div_u|rem_u|and|or|xor|shl|shr_s|shr_u)|" +
                               "i64\\.(?:load|store|store8|const)|f32\\.(?:load|const)|f64\\.(?:load|const)|" +
                               "unreachable|nop|block|loop|if|else|end|br_table|br_if|br|return|call_indirect|call|drop|select|" +
                               "i32|i64|f32|f64|META)\\b"
                    },
                    
                    // Inline Hex codes & Index Numerics inside code comments
                    { token: "constant.numeric", regex: "\\b0x[0-9A-Fa-f]+\\b|\\b\\d+\\b" },
                    
                    // Instruction Flow arrows
                    { token: "keyword.operator", regex: " -> " }
                ]
            };
        };
    r.inherits(s, i), t.WasmBlueprintHighlightRules = s;
});

ace.define("ace/mode/wasm_disassembly", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/wasm_disassembly_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./wasm_disassembly_rules").WasmBlueprintHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = ";",
        this.$id = "ace/mode/wasm_disassembly";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    ace.require(["ace/mode/wasm_disassembly"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();