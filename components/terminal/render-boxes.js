/**
 * Unified Layout System for xterm.js UI Matrix Generation
 */

// Global color stack tracking to support deep context-nested de-colorization states
if (typeof self !== 'undefined' && !self.cliColorizeStack) {
    self.cliColorizeStack = [0];
} else if (typeof window !== 'undefined' && !window.cliColorizeStack) {
    window.cliColorizeStack = [0];
}

const colorStack = (typeof self !== 'undefined' ? self : window).cliColorizeStack;

// Helper Regex to instantly find and clean ANSI ESC characters for true string boundary measurements
const ANSI_REGEX = /\x1B\[[0-9;]*[a-zA-Z]/g;

/**
 * Returns the true visible character length of an ANSI stylized string.
 */
function getVisibleLength(str) {
    if (!str) return 0;
    return str.replace(ANSI_REGEX, '').length;
}

/**
 * Finds the longest visible string length among an array of row objects for column tracking.
 */
function cliGetColumnsLengths(input) {
    const columnLengths = {};
    input.forEach(file => {
        for (const [column, value] of Object.entries(file)) {
            if (typeof value !== 'object' && value !== null) {
                const valLen = getVisibleLength(String(value));
                const colLen = getVisibleLength(String(column));
                columnLengths[column] = Math.max(columnLengths[column] || 0, valLen, colLen);
            }
        }
    });
    return columnLengths;
}

function cliColorize(color) {
    colorStack.push(color);
    return `\x1b[${color}m`;
}

function cliDecolorize() {
    // Drop current color context frame
    colorStack.pop();
    // Rehydrate previous cascade color profile string
    const lastColor = colorStack[colorStack.length - 1] || 0;
    return `\x1b[${lastColor}m`;
}

function cliGetMaxWidth(lines) {
    let max = 0;
    for (const [column, value] of Object.entries(lines)) {
        if (typeof value === 'string') {
            max = Math.max(max, getVisibleLength(value), getVisibleLength(column));
        }
    }
    return max;
}

/**
 * Encapsulates text data within a highly customizable ANSI terminal panel matrix box block.
 */
function cliBox(input, topLine = true, leftLine = true, bottomLine = true, rightLine = true, width = 0, color = null) {
    const targetWidth = Math.floor(width);
    const lines = String(input).split("\n");
    
    // Process text parameters ignoring raw back buffer graphic sequence overhead
    const unescapedLines = lines.map(l => l.replace(ANSI_REGEX, ''));
    let maxVisibleWidth = 0;
    unescapedLines.forEach(l => {
        if (l.length > maxVisibleWidth) maxVisibleWidth = l.length;
    });

    if (targetWidth > 0 && targetWidth > maxVisibleWidth) {
        maxVisibleWidth = targetWidth;
    }

    const currentContextColor = colorStack[colorStack.length - 1] || 32;
    let result = '';

    // --- RENDER TOP BORDER ROW ---
    if (topLine) {
        const borderChar = '-';
        let topTitle = typeof topLine === 'string' ? topLine : '';
        
        // Pad out standard string boundary calculations cleanly
        const padSize = maxVisibleWidth - getVisibleLength(topTitle);
        const middleFill = topTitle + (padSize > 0 ? borderChar.repeat(padSize) : '');

        if (color !== null) result += `\x1b[${color}m`;
        result += leftLine ? '.-' : '';
        result += middleFill;
        result += rightLine ? '.' : '';
        if (color !== null) result += `\x1b[${currentContextColor}m`;
        result += "\r\n"; // Standard xterm carriage-return line breaks
    }

    // --- RENDER MIDDLE ROW CONTENT MATRIX ---
    lines.forEach((line, i) => {
        const visibleLength = getVisibleLength(line);
        const paddingNeeded = maxVisibleWidth - visibleLength;
        const paddedLine = line + ' '.repeat(Math.max(0, paddingNeeded));

        if (color !== null) {
            result += `\x1b[${color}m` + (leftLine ? '| ' : '') + `\x1b[${currentContextColor}m` + paddedLine + `\x1b[${color}m` + (rightLine ? '|' : '') + `\x1b[${currentContextColor}m\r\n`;
        } else {
            result += (leftLine ? '| ' : '') + paddedLine + (rightLine ? '|' : '') + "\r\n";
        }
    });

    // --- RENDER BOTTOM BORDER ROW ---
    if (bottomLine) {
        if (color !== null) result += `\x1b[${color}m`;
        result += leftLine ? '|_' : '';
        result += '_'.repeat(maxVisibleWidth);
        result += rightLine ? '|' : '';
        if (color !== null) result += `\x1b[${currentContextColor}m`;
        result += "\r\n";
    }

    return result;
}

/**
 * Combines multiple generated ANSI drawing boxes horizontally side-by-side.
 */
function cliMergeBoxes(...boxes) {
    const linesCollection = [];
    const lastLinesCollection = [];
    let maxLines = 0;

    boxes.forEach((box, i) => {
        if (typeof box !== 'string') return;
        const splitBox = box.split("\r\n");
        // Pop trailing blank elements caused by terminal newlines
        if (splitBox[splitBox.length - 1] === '') splitBox.pop();
        
        const lastRow = splitBox.pop();
        linesCollection[i] = splitBox;
        lastLinesCollection[i] = lastRow;
        maxLines = Math.max(splitBox.length, maxLines);
    });

    let result = '';
    for (let i = 0; i < maxLines; i++) {
        linesCollection.forEach((boxRows, j) => {
            if (boxRows[i] !== undefined) {
                result += boxRows[i];
            } else {
                // If a shorter box runs out of rows before its siblings,
                // generate invisible spacing layouts to preserve column boundaries.
                const fallbackTemplateRow = boxRows[0] || '';
                const leftMatch = fallbackTemplateRow.match(/^(\x1b\[[0-9;]*[a-zA-Z])*[|.]/i);
                const rightMatch = fallbackTemplateRow.match(/[|.](\x1b\[[0-9;]*[a-zA-Z])*$/i);
                
                const leftBorder = leftMatch ? leftMatch[0] : '';
                const rightBorder = rightMatch ? rightMatch[0] : '';
                
                const visibleWidth = getVisibleLength(fallbackTemplateRow) - (leftBorder ? 1 : 0) - (rightBorder ? 1 : 0);
                result += leftBorder + ' '.repeat(Math.max(0, visibleWidth)) + rightBorder;
            }
        });
        result += "\r\n";
    }

    lastLinesCollection.forEach(lastRow => {
        if (lastRow) result += lastRow;
    });

    result += "\r\n";
    return result;
}

/**
 * Standard word wrapping engine that wraps text without tearing ANSI formatting sequences.
 */
function cliWordwrap(text, width) {
    if (!text || text.length === 0) return '';
    const targetWidth = Math.floor(width);
    
    const words = text.split(' ');
    let currentLine = '';
    let result = '';

    words.forEach(word => {
        const lineLen = getVisibleLength(currentLine);
        const wordLen = getVisibleLength(word);

        if (lineLen + wordLen + (lineLen > 0 ? 1 : 0) > targetWidth) {
            result += currentLine + "\r\n";
            currentLine = word;
        } else {
            currentLine += (currentLine.length > 0 ? ' ' : '') + word;
        }
    });

    if (currentLine.length > 0) {
        result += currentLine;
    }

    return result;
}


function renderTerminalMenu(terminalInstance, menuData) {
    const width = terminalInstance.cols || 80;
    
    // Establish table columns sizing widths
    const colWidth = Math.floor(width / 3);

    // Write top header line row boundary panel
    let outputBuffer = cliMergeBoxes(
        cliBox('Menu Option Name', true, true, true, true, colWidth, 34), 
        cliBox('Path Routing Link', true, false, true, true, colWidth, 34), 
        cliBox('Functional Description', true, false, true, true, colWidth, 34)
    );

    // Loop objects matrix rows
    menuData.forEach(item => {
        const cell1 = cliBox(cliWordwrap(item.name, colWidth - 3), false, true, true, true, colWidth);
        const cell2 = cliBox(cliWordwrap(item.path, colWidth - 3), false, false, true, true, colWidth);
        const cell3 = cliBox(cliWordwrap(item.description, colWidth - 3), false, false, true, true, colWidth);

        outputBuffer += cliMergeBoxes(cell1, cell2, cell3);
    });

    // Output clean data buffer straight onto screen
    terminalInstance.write(outputBuffer);
}
