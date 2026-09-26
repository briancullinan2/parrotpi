ace.define("ace/mode/qvm_disassembly_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            
            // Comprehensive regular expression built from the QVM Opcode Matrix
            const qvmOpcodesRegex = "\\b(?:UNDEF|IGNORE|BREAK|ENTER|LEAVE|CALL|PUSH|POP|CONST|LOCAL|JUMP|" +
                                    "EQ|NE|LTI|LEI|GTI|GEI|LTU|LEU|GTU|GEU|EQF|NEF|LTF|LEF|GTF|GEF|" +
                                    "LOAD1|LOAD2|LOAD4|STORE1|STORE2|STORE4|ARG|BLOCK_COPY|SEX8|SEX16|" +
                                    "NEGI|ADD|SUB|DIVI|DIVU|MODI|MODU|MULI|MULU|BAND|BOR|BXOR|BCOM|" +
                                    "LSH|RSHI|RSHU|NEGF|ADDF|SUBF|DIVF|MULF|CVIF|CVFI|" +
                                    // Lowercase variations for standard compiler dumps
                                    "undef|ignore|break|enter|leave|call|push|pop|const|local|jump|" +
                                    "eq|ne|lti|lei|gti|gei|ltu|leu|gtu|geu|eqf|nef|ltf|lef|gtf|gef|" +
                                    "load1|load2|load4|store1|store2|store4|arg|block_copy|sex8|sex16|" +
                                    "negi|add|sub|divi|divu|modi|modu|muli|mulu|band|bor|bxor|bcom|" +
                                    "lsh|rshi|rshu|negf|addf|subf|divf|mulf|cvif|cvfi)\\b";

            this.$rules = {
                start: [
                    // Structural Header Dividers & Meta Sections
                    { token: "punctuation.definition.comment", regex: "^[=-]{10,}$" },
                    { token: "comment.heading", regex: "^(?:QVM|Binary|Program|Instruction|Data|BSS|Side-by-Side|Status).*$" },
                    
                    // Code block labels / functions (e.g., sub_00000BC0:)
                    { token: "entity.name.function", regex: "\\bsub_[0-9A-Fa-f]+:?" },
                    { token: "entity.name.function", regex: "^\\s*[A-Za-z0-9_]+(?=:)" },
                    
                    // Hex text memory addresses (0x0B80: or 000009b4)
                    { token: "constant.numeric.address", regex: "\\b0x[0-9A-Fa-f]+:" },
                    { token: "constant.numeric.address", regex: "^[0-9A-Fa-f]{8}\\b" },
                    
                    // Text Column interpretation layer (| ................ |)
                    { token: "string.inline", regex: "\\|[^|]*\\|" },
                    
                    // Inline String literals embedded inside trace elements
                    { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },
                    
                    // Intercept complex engine telemetry blocks and shift evaluation state
                    { token: "comment.line", regex: ";\\s*ASM:\\s*\\x5b", next: "qvm_asm_trace" },
                    
                    // Standard assembly comment lines fallback (e.g., ; trap_R_RegisterShader())
                    { token: "comment.line", regex: ";.*$" },
                    
                    // Opcode Mnemonics
                    { token: "keyword", regex: qvmOpcodesRegex },
                    
                    // Signed / Unsigned hexadecimal values and operational index scalars
                    { token: "constant.numeric", regex: "-?0x[0-9A-Fa-f]+\\b" },
                    { token: "constant.numeric", regex: "\\b-?\\d+\\b" }
                ],
                qvm_asm_trace: [
                    // Pop back to standard line evaluations when array boundary closes
                    { token: "comment.line", regex: "\\x5d.*$", next: "start" },
                    
                    // Highlight opcodes and sub-routines executing inside trace scopes
                    { token: "keyword", regex: qvmOpcodesRegex },
                    { token: "entity.name.function", regex: "\\bsub_[0-9A-Fa-f]+\\b" },
                    { token: "constant.numeric", regex: "0x[0-9A-Fa-f]+\\b|\\b\\d+\\b" },
                    
                    // Execution pipeline path arrows
                    { token: "keyword.operator", regex: "->" },
                    { token: "comment.line", regex: "[^\\x5d]+" }
                ]
            };
        };
    r.inherits(s, i), t.QVMDisassemblyHighlightRules = s;
});

ace.define("ace/mode/qvm_disassembly", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/qvm_disassembly_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./qvm_disassembly_highlight_rules").QVMDisassemblyHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = ";",
        this.$id = "ace/mode/qvm_disassembly";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    ace.require(["ace/mode/qvm_disassembly"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();