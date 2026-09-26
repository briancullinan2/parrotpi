/**
 * Copyright 2026 WebAssembly Community Group participants
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

let port;
const AntlrRegistry = self.AntlrLanguages;


function createLexerInstance(sourceText, languageKey) {
    if (!languageKey) return null;

    // 1. Force the lookup key to be fully normalized lowercase
    const cleanKey = languageKey.toLowerCase().trim();
    const lookupKey = `${cleanKey}_lexer`;

    let LexerCtor = AntlrRegistry[lookupKey];

    // Sane localized compiler overrides map
    if (!LexerCtor) {
        if (cleanKey === 'python') LexerCtor = AntlrRegistry['python3_lexer'];
    }

    if (!LexerCtor) {
        console.error(`[Worker] Normalized target look-up key '${lookupKey}' not found in registry matrix.`);
        return null;
    }

    const antlr = AntlrRegistry.antlr4;
    let chars;
    try {
        chars = (antlr.CharStreams && typeof antlr.CharStreams.fromString === 'function')
            ? antlr.CharStreams.fromString(sourceText)
            : new antlr.InputStream(sourceText);

        if (LexerCtor.normalizeInputStream && typeof LexerCtor.normalizeInputStream === 'function') {
            chars = LexerCtor.normalizeInputStream(chars);
        } else if (LexerCtor.prototype && Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream) {
            chars = Object.getPrototypeOf(LexerCtor.prototype).constructor.normalizeInputStream(chars);
        }


        // 1. Instantiate the stream pipeline completely natively
        //const chars = new AntlrRegistry.antlr4.InputStream(codeString);
        const lexer = new LexerCtor(chars);
        //const tokens = new AntlrRegistry.antlr4.CommonTokenStream(lexer);

        // ─── THE SIDE-EFFECT FREE FIXED INTERCEPT LOOP ───
        // Force-fill the stream buffer array natively so we can work with real instances
        //tokens.fill();
        /*
        // Walk the flat array cache and memoize text explicitly
        if (tokens.tokens && Array.isArray(tokens.tokens)) {
            for (let i = 0; i < tokens.tokens.length; i++) {
                const t = tokens.tokens[i];

                // Skip mutations if ANTLR already hard-baked an EOF or special token string value
                if (t._text !== null && t._text !== undefined) continue;

                try {
                    // Hard-bind the sliced string directly to avoid the lazy-evaluation getter bugs
                    t.text = codeString.substring(t.start, t.stop + 1);
                } catch (e) {
                    t.text = "";
                }
            }
        }
        */

        return lexer
    } catch (e) {
        console.error(`[Worker] Failed to spin up ANTLR string stream for look-up '${lookupKey}':`, e);
        return null;
    }
}

function _safePreprocess(sourceText, languageKey, onResolveInclude, onErrorFound) {
    try {
        return preprocessSourceText(sourceText, languageKey, onResolveInclude, onErrorFound);
    } catch (e) {
        console.error("[Preprocessor Crisis] Virtual assembly layer collapsed:", e);
        return sourceText;
    }
}


/**
 * Pure transformation callback formatting incoming ANTLR syntax errors
 */
function processSyntaxError(lines, annotations, syntaxError) {
    const zeroIndexedRow = syntaxError.line - 1;
    const activeLineText = lines[zeroIndexedRow] || "";
    const cleanLine = activeLineText.replace(/\t/g, '    ');

    const leadingSpaces = ' '.repeat(Math.max(0, syntaxError.column));
    const caretMarker = `${leadingSpaces}^~~~~`;

    const clangDiagnosticText = [
        `stdin.c:${syntaxError.line}:${syntaxError.column + 1}: error: ${syntaxError.message}`,
        cleanLine.trimEnd(),
        caretMarker
    ].join('\n');

    annotations.push({
        row: zeroIndexedRow,
        column: syntaxError.column,
        text: clangDiagnosticText,
        type: "error"
    });
}


function _extractSemanticOverrides(lines, tokenStream, languageKey, annotations, lexer, emitter) {
    const semanticOverrides = new Map();
    if (!languageKey) return [semanticOverrides, null];

    const cleanKey = languageKey.toLowerCase().trim();
    const lookupKey = `${cleanKey}_parser`;
    let ParserCtor = AntlrRegistry[lookupKey];
    if (!ParserCtor) return [semanticOverrides, null];

    const parser = new ParserCtor(tokenStream);
    parser.removeErrorListeners();

    if (parser._interp && AntlrRegistry.antlr4?.atn?.PredictionMode) {
        parser._interp.predictionMode = AntlrRegistry.antlr4.atn.PredictionMode.LL;
    }

    // --- STEP 1: WIRE UP SYNTAX ERROR LISTENERS FOR THE UX ---
    parser.addErrorListener({
        reportAmbiguity: function (recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs) {
            // Absorb deep SLL prediction branching conflicts silently
        },
        reportContextSensitivity: function (recognizer, dfa, startIndex, stopIndex, prediction, configs) {
            // Absorb fallback optimization logs smoothly
        },
        reportAttemptingFullContext: function (recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs) {
            // CRITICAL PROXIMATE GAP FIX: Satisfies the engine when dropping into deep LL validation
        },
        syntaxError: (recognizer, offendingSymbol, line, column, msg) => {

            // Pass the active lines array context and aggregate directly
            // 'lines' must be available in scope or passed into
            if (typeof processSyntaxError === 'function' && typeof lines !== 'undefined') {
                processSyntaxError(lines, annotations, { line, column, message: msg });
            } else {
                // Inline fallback if line parsing contexts are dropped
                annotations.push({
                    row: line - 1,
                    column: column,
                    text: msg,
                    type: "error"
                });
            }

            if (offendingSymbol && typeof offendingSymbol.start === 'number') {
                const errorScope = "text.syntax_error.err_notfound.annotation_required";
                semanticOverrides.set(offendingSymbol.start, errorScope);
            }
        }
    });




    // --- STEP 2: CUSTOM ERROR STRATEGY FOR SOFT ERROR ABSORPTION ---
    const ErrorNamespace = AntlrRegistry.antlr4?.error || {};
    const BaseStrategy = ErrorNamespace.DefaultErrorStrategy;

    let customStrategyInstance;

    if (BaseStrategy) {
        // Use modern ES6 class syntax to inherit safely from native class constructors
        class SoftErrorRecoveryStrategy extends BaseStrategy {
            constructor() {
                super();
            }

            // Override to handle minor structural deviations quietly
            reportNoViableAlternative(recognizer, e) {
                // Quietly absorb soft alternatives during structural pass
            }

            // Override to absorb inline token insertion errors silently
            reportUnwantedToken(recognizer, e) {
                // Soft error: keep UX feedback clean by overriding default logging
            }
        }

        customStrategyInstance = new SoftErrorRecoveryStrategy();
    } else {
        // Safe fallback if the registry isn't fully structured
        const BailStrategy = ErrorNamespace.BailErrorStrategy;
        customStrategyInstance = BailStrategy ? new BailStrategy() : null;
    }

    if (customStrategyInstance) {
        parser._errHandler = customStrategyInstance;
    }



    let tree = null;
    try {
        const targetRules = parser.ruleNames || (parser.constructor && parser.constructor.ruleNames);
        if (targetRules && targetRules[0] && typeof parser[targetRules[0]] === 'function') {
            const rootRuleName = targetRules[0]; // Resolves straight to "json" or "compilationUnit"
            console.log(`[Worker] Dynamic execution target acquired: parser.${rootRuleName}()`);
            tree = parser[rootRuleName]();
        }
    } catch (err) {
        console.warn("[Worker] Structural parse crash:", err);
    }

    if (tree) {
        const transmittedLines = new Set();
        const processTokenIntoChunk = (token, chunkObj) => {
            let tokenText = token.text || "";
            if (tokenText.endsWith('\r')) tokenText = tokenText.slice(0, -1);
            if (tokenText === "") return;

            const tokenRow = token.line - 1;
            if (!chunkObj[tokenRow]) {
                chunkObj[tokenRow] = [];
            }

            // 1. Check for deep AST walker context overrides first
            let classification = semanticOverrides.get(token.start);

            // 2. RESTORED FALLBACK: Drop into toRosettaToken exactly like your old code did
            if (!classification) {
                const rawTypeName = _resolveTokenTypeName ? _resolveTokenTypeName(lexer, token.type) : (lexer.constructor.symbolicNames[token.type] || "text");

                classification = toRosettaToken(
                    rawTypeName,
                    token.tokenRule,
                    lexer,
                    parser,
                    token,
                    tokenStream,
                    rawTypeName
                );

                // Sanitize edge-case token names leaking directly from native grammars
                //const lowerClass = classification ? classification.toLowerCase() : "text";
                //if (lowerClass.includes("comment")) {
                //    classification = "comment.line";
                //} else if (lowerClass.includes("include") || lowerClass.includes("define") || lowerClass.includes("preprocessor")) {
                //    debugger
                //    classification = "meta.preprocessor";
                //}
            }

            if (tokenText.includes('\n')) {
                const pieces = tokenText.split('\n');
                pieces.forEach((piece, offset) => {
                    const targetRow = tokenRow + offset;
                    if (piece.endsWith('\r')) piece = piece.slice(0, -1);
                    if (piece === "" && offset === pieces.length - 1) return;

                    if (!chunkObj[targetRow]) chunkObj[targetRow] = [];
                    chunkObj[targetRow].push({ type: classification, value: piece });
                });
            } else {
                chunkObj[tokenRow].push({ type: classification, value: tokenText });
            }
        };

        // High-level structural arrays used for chunk block aggregation
        let activeBlockTokenLines = [];
        let activeBlockAnnotations = [];

        const configurationListener = {
            enterEveryRule: function (ctx) {
                const ruleName = parser.ruleNames[ctx.ruleIndex];
                console.log(`Rule: ${ruleName} | Invoking State: ${ctx.invokingState}`);
            },

            visitTerminal: function (node) {
                const token = node.symbol;
                const ctx = node.parentCtx;

                // 1. RE-ESTABLISH THE INHERITANCE TRACE FOR TO-ROSETTA-TOKEN
                const ruleHistory = [];
                let currentCtx = ctx;
                while (currentCtx) {
                    if (currentCtx.ruleIndex !== undefined && parser.ruleNames[currentCtx.ruleIndex]) {
                        ruleHistory.push(parser.ruleNames[currentCtx.ruleIndex]);
                    }
                    currentCtx = currentCtx.parentCtx;
                }

                const ruleName = parser.ruleNames[ctx.ruleIndex];
                const tokenText = token.text;
                const tokenTypeString = lexer.constructor.symbolicNames[token.type] || "text";

                // Attach payload metadata anchors so toRosettaToken works perfectly
                token.ruleHistory = ruleHistory;
                token.contextNode = ctx;

                console.log(`Token: "${tokenText}" | Direct Rule: ${ruleName} | Line: ${token.line} | Inherited Trace Array:`, ruleHistory);
                // 2. COMPUTE THE ACCURATE SCOPE OVERRIDE VALUE
                if (token.text.includes('#include')) {
                    debugger
                }
                const generalScope = toRosettaToken(tokenTypeString, ruleName, lexer, parser, token, tokenStream);
                semanticOverrides.set(token.start, generalScope);

                processStructuralFlags(annotations, token);
            },

            exitEveryRule: function (ctx) {
                const ruleName = parser.ruleNames[ctx.ruleIndex];

                if (ruleName === 'functionBody' || ruleName === 'compoundStatement' || ruleName === 'block') {
                    const startToken = ctx.start;
                    const stopToken = ctx.stop;

                    if (startToken && stopToken) {
                        let startIdx = startToken.tokenIndex;
                        while (startIdx > 0) {
                            const prevToken = tokenStream.get(startIdx - 1);
                            if (!prevToken || prevToken.line < startToken.line) {
                                break;
                            }
                            startIdx--;
                        }

                        const blockAnnotations = annotations.filter(ann =>
                            ann.row >= (startToken.line - 1) && ann.row <= (stopToken.line - 1)
                        );

                        const slicedTokenLines = {};
                        const allBlockTokens = tokenStream.getTokens(startIdx, stopToken.tokenIndex);

                        allBlockTokens.forEach(token => {
                            processTokenIntoChunk(token, slicedTokenLines);
                            transmittedLines.add(token.line - 1);
                        });

                        emitter.emit("highlight", {
                            fileId: this.activeFileId,
                            startLine: startToken.line,
                            endLine: stopToken.line,
                            tokenLinesChunk: slicedTokenLines,
                            annotationsChunk: blockAnnotations
                        });
                    }
                }
            },

            visitErrorNode: function (node) { }
        };

        const walker = new AntlrRegistry.antlr4.tree.ParseTreeWalker();
        walker.walk(configurationListener, tree);

        // ─── FINAL BASELINE SWEEP ───
        // Catch globals, includes, and remaining filespace that sit outside function blocks
        const globalTokenLinesChunk = {};

        // Use all tokens from the stream natively
        let allTokens = [];
        if (typeof tokenStream.getTokens === 'function') allTokens = tokenStream.getTokens();
        if (!allTokens || allTokens.length === 0) allTokens = tokenStream.tokens || [];

        allTokens.forEach(token => {
            if (!token || token.type === AntlrRegistry.antlr4.Token.EOF) return;

            const tokenRow = token.line - 1;

            // Only capture if this line wasn't already updated by an inner block chunk pass
            if (!transmittedLines.has(tokenRow)) {

                // This call natively reads from your fully completed semanticOverrides Map!
                processTokenIntoChunk(token, globalTokenLinesChunk);
            }
        });


        // If there's any out-of-scope metadata found, push it over in one clean deployment strike
        if (Object.keys(globalTokenLinesChunk).length > 0) {
            emitter.emit("highlight", {
                fileId: this.activeFileId,
                startLine: 1,
                endLine: lines.length,
                tokenLinesChunk: globalTokenLinesChunk,
                annotationsChunk: annotations.filter(ann => !transmittedLines.has(ann.row))
            });
        }
    }

    return [semanticOverrides, parser];
}

/**
 * Single-pass compilation token provider.
 * Spins up a single lexer/parser pipeline, executes the semantic override tree walk,
 * and handles inline annotations directly.
 */
function runParserPipeline(sourceText, languageKey, annotations, emitter) {
    const antlr = AntlrRegistry.antlr4;

    // 1. Safe preprocessing phase pass
    const lines = sourceText.split('\n')
    const unifiedSourceBuffer = _safePreprocess(sourceText, languageKey, null, (err) => {
        annotations.push({ row: err.line - 1, column: err.column, text: err.message, type: "error" });
    });

    // 2. Spin up ONE single Lexer instance
    const pipelineLexer = createLexerInstance(unifiedSourceBuffer, languageKey);
    if (!pipelineLexer) return null;

    // 3. Spin up ONE single standard token stream
    const tokenStream = new antlr.CommonTokenStream(pipelineLexer);

    // 4. Run the deep semantic scanner walker
    // This directly kicks off chunked streaming passes via your 'exitEveryRule' gates
    const [semanticOverrides, parser] = _extractSemanticOverrides(
        lines,
        tokenStream,
        languageKey,
        annotations,
        pipelineLexer, // Pass the active lexer for type resolution mapping
        emitter
    );

    return parser;
}


function preprocessSourceText(sourceText, languageKey, onResolveInclude, onErrorFound, visitedFiles = new Set()) {
    if (typeof onResolveInclude !== 'function') return sourceText;

    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return sourceText;

    let expandedText = "";
    let token = lexer.nextToken();
    const antlr = AntlrRegistry.antlr4;

    while (token.type !== antlr.Token.EOF) {
        const rawTypeName = _resolveTokenTypeName(lexer, token.type);




        // TODO: resolve header types
        if (rawTypeName === 'Directive' || token.text.trim().startsWith('#include')) {
            const includeMatch = token.text.match(/#include\s*["<]([^">]+)[">]/);
            if (includeMatch && includeMatch[1]) {
                const targetFileName = includeMatch[1].trim();

                if (!visitedFiles.has(targetFileName)) {
                    visitedFiles.add(targetFileName);
                    try {
                        const headerContents = onResolveInclude(targetFileName);
                        if (headerContents) {
                            const fullyExpandedHeader = preprocessSourceText(headerContents, languageKey, onResolveInclude, onErrorFound, visitedFiles);
                            expandedText += `\n/* --- Start Unified Include: ${targetFileName} --- */\n`;
                            expandedText += fullyExpandedHeader;
                            expandedText += `\n/* --- End Unified Include: ${targetFileName} --- */\n`;
                        }
                    } catch (err) {
                        // Track missing dependencies in a global context register for the token mapper to read
                        if (typeof window !== 'undefined') {
                            window.__missingHeaders = window.__missingHeaders || new Set();
                            window.__missingHeaders.add(targetFileName);
                        }
                        expandedText += `\n/* Missing Header Dependency: ${targetFileName} */\n`;
                        onErrorFound({ line: token.start.line, column: token.start.column, message: err.message });
                    }
                }
            } else {
                expandedText += token.text;
            }
        } else {
            expandedText += token.text;
        }
        token = lexer.nextToken();
    }
    return expandedText;
}

function getFoldRegions(sourceText, languageKey) {
    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return [];

    const folds = [];
    const braceStack = [];
    const preprocessorStack = [];
    let token = lexer.nextToken();
    const eof = AntlrRegistry.antlr4.Token.EOF;

    while (token.type !== eof) {
        const typeName = _resolveTokenTypeName(lexer, token.type);
        const row = token.line - 1;

        if (typeName === 'OpenCurlyBracket' || token.text === '{') {
            braceStack.push(row);
        } else if (typeName === 'CloseCurlyBracket' || token.text === '}') {
            if (braceStack.length > 0) {
                const startRow = braceStack.pop();
                if (row > startRow) folds.push({ startRow, endRow: row, type: 'brace' });
            }
        }

        if (token.text.startsWith('#if') || token.text.startsWith('#ifdef')) {
            preprocessorStack.push(row);
        } else if (token.text.startsWith('#endif')) {
            if (preprocessorStack.length > 0) {
                const startRow = preprocessorStack.pop();
                if (row > startRow) folds.push({ startRow, endRow: row, type: 'preprocessor' });
            }
        }

        if (token.channel === 1 || ['BlockComment', 'MULTI_LINE_COMMENT'].includes(typeName)) {
            const textLines = token.text.split('\n');
            if (textLines.length > 1) {
                folds.push({ startRow: row, endRow: row + textLines.length - 1, type: 'comment' });
            }
        }
        token = lexer.nextToken();
    }
    return folds;
}

function getTokensForLine(sourceText, languageKey, targetLine) {
    const lexer = createLexerInstance(sourceText, languageKey);
    if (!lexer) return [];

    const lineTokens = [];
    let token = lexer.nextToken();
    const eof = AntlrRegistry.antlr4.Token.EOF;

    while (token.type !== eof) {
        if (token.line > targetLine) break;
        if (token.line === targetLine) {
            lineTokens.push({
                text: token.text,
                type: _resolveTokenTypeName(lexer, token.type),
                start: token.start,
                stop: token.stop,
                column: token.column,
                channel: token.channel
            });
        }
        token = lexer.nextToken();
    }
    return lineTokens;
}


const onAnyMessage = async event => {
    const { id, data, responseId } = event.data;
    if (!id) return;
    let output = null;

    try {
        switch (id) {
            case 'constructor':
                port = event.data.data;
                port.onmessage = onAnyMessage;

                self.language = {
                    lineToken: async (text, language, line) => await self.onmessage({ id: 'lineToken', data: { text, language, line } }),
                };
                return;

            case 'lineToken':
                output = getTokensForLine(data.text, data.language, data.line);
                break;

            case 'folds':
                output = getFoldRegions(data.text, data.language);
                break;

            default:
                output = { status: 'unhandled_command' };
                break;
        }
    } catch (e) {
        output = { error: e.toString(), stack: e.stack };
    } finally {
        if (port && id !== 'constructor') {
            port.postMessage({ id: 'runAsync', responseId, data: output });
        }
    }
};

self.addEventListener('message', onAnyMessage);
