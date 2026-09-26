ace.define("ace/mode/cmake_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            
            // Explicit Core Command Invocation Registry
            var coreCommands = "add_compile_definitions|add_compile_options|add_custom_command|add_custom_target|" +
                               "add_definitions|add_dependencies|add_executable|add_library|add_link_options|" +
                               "add_subdirectory|add_test|aux_source_directory|break|cmake_host_system_information|" +
                               "cmake_minimum_required|cmake_parse_arguments|cmake_path|cmake_policy|configure_file|" +
                               "continue|create_test_suite|define_property|else|elseif|enable_language|endforeach|" +
                               "endfunction|endif|endmacro|endwhile|execute_process|export|file|find_file|" +
                               "find_library|find_path|find_package|find_program|fltk_wrap_ui|foreach|function|" +
                               "get_cmake_property|get_directory_property|get_filename_component|get_property|" +
                               "get_source_file_property|get_target_property|get_test_property|if|include|" +
                               "include_guard|include_directories|include_external_msproject|include_regular_expression|" +
                               "install|link_directories|link_libraries|list|load_cache|macro|mark_as_advanced|" +
                               "message|option|project|return|separate_arguments|set|set_directory_properties|" +
                               "set_property|set_source_files_properties|set_target_properties|set_tests_properties|" +
                               "site_name|source_group|string|target_compile_definitions|target_compile_features|" +
                               "target_compile_options|target_include_directories|target_link_directories|" +
                               "target_link_libraries|target_link_options|target_precompile_headers|" +
                               "target_sources|try_compile|try_run|unset|while";

            var keywordMapper = this.createKeywordMapper({
                "keyword.control": coreCommands
            }, "identifier");

            this.$rules = {
                "start": [
                    // Bracket_comment: '#[' Bracket_arg_nested ']'
                    {
                        token: "comment.block",
                        regex: "#\\[=*\\[",
                        next: "bracket_comment"
                    },
                    // Line_comment: '#' (~['\r'|'\n'])*
                    {
                        token: "comment.line",
                        regex: "#.*$"
                    },
                    // Bracket_argument: '[' Bracket_arg_nested ']'
                    {
                        token: "string.block",
                        regex: "\\[=*\\[",
                        next: "bracket_argument"
                    },
                    // Quoted_argument start boundary
                    {
                        token: "string.quoted",
                        regex: '"',
                        next: "quoted_argument"
                    },
                    // Explicit Command Invocation Context: Identifier immediately preceding '('
                    {
                        token: ["support.function", "punctuation.definition"],
                        regex: "([A-Za-z_][A-Za-z0-9_]*|\\b)(?=\\s*\\()"
                    },
                    // Standard Identifiers and Built-in Command evaluations
                    {
                        token: keywordMapper,
                        regex: "[A-Za-z_][A-Za-z0-9_]*\\b"
                    },
                    // High-density Variable Expansion tracking: ${VARIABLE}
                    {
                        token: "variable.parameter",
                        regex: "\\x24\\x7b[^\\x7d]+\\x7d"
                    },
                    // Semicolons (Escape_semicolon / explicit delimiters)
                    {
                        token: "punctuation.operator",
                        regex: ";"
                    },
                    // Structural Parentheses bounds matching compound_argument layers
                    { token: "paren.lparen", regex: "\\(" },
                    { token: "paren.rparen", regex: "\\)" },
                    
                    // Escape_sequence outside string constants
                    {
                        token: "constant.character.escape",
                        regex: "\\\\(?:[ntr;]|.)"
                    }
                ],
                "bracket_comment": [
                    {
                        token: "comment.block",
                        regex: "\\]=*\\]",
                        next: "start"
                    },
                    {
                        defaultToken: "comment.block"
                    }
                ],
                "bracket_argument": [
                    {
                        token: "string.block",
                        regex: "\\]=*\\]",
                        next: "start"
                    },
                    {
                        defaultToken: "string.block"
                    }
                ],
                "quoted_argument": [
                    {
                        token: "string.quoted",
                        regex: '"',
                        next: "start"
                    },
                    // Escape_sequence inside quotes (including Quoted_cont multi-line backslash hooks)
                    {
                        token: "constant.character.escape",
                        regex: "\\\\(?:[ntr;]|\\r?\\n|.)"
                    },
                    // Interpolated variables evaluation within strings
                    {
                        token: "variable.parameter",
                        regex: "\\x24\\x7b[^\\x7d]+\\x7d"
                    },
                    {
                        defaultToken: "string.quoted"
                    }
                ]
            };
            
            this.normalizeRules();
        };
        
    r.inherits(s, i), t.CMakeHighlightRules = s;
});

ace.define("ace/mode/cmake", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/cmake_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./cmake_highlight_rules").CMakeHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = "#";
        this.$id = "ace/mode/cmake";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    ace.require(["ace/mode/cmake"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();