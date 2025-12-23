import React, { useState, useEffect } from 'react';

interface OriginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface TerminalLine {
    text: string;
    style?: string; // Tailwind classes
    delay?: number; // Pause after typing this line
}

const CONTENT: TerminalLine[] = [
    { text: "INITIATING ORIGIN PROTOCOL...", style: "text-[#0EA5E9] font-bold", delay: 500 },
    { text: "LOADING MANIFESTO...", style: "text-gray-500", delay: 300 },
    { text: "", delay: 100 },
    { text: "Built in public. Funded by nothing. Accountable to users.", style: "text-white" },
    { text: "", delay: 100 },
    { text: "> No VC cap table.", style: "text-gray-400 pl-4" },
    { text: "> No insider token allocations.", style: "text-gray-400 pl-4" },
    { text: "> No 'advisors' who just changed their Twitter bio.", style: "text-gray-400 pl-4" },
    { text: "", delay: 200 },
    { text: "This is how Satoshi did it.", style: "text-[#0EA5E9]" },
    { text: "How Uniswap started.", style: "text-[#0EA5E9]" },
    { text: "How real protocols emerge.", style: "text-[#0EA5E9]" },
    { text: "", delay: 200 },
    { text: "One person. One vision. Pure code.", style: "text-white text-lg font-bold" },
    { text: "", delay: 200 },
    { text: "VALUE DISTRIBUTION MATRIX:", style: "text-gray-500 text-xs mt-4" },
    { text: "1. Users who provide attention", style: "text-gray-300 pl-4" },
    { text: "2. Agents who need verification", style: "text-gray-300 pl-4" },
    { text: "3. Protocol sustainability", style: "text-gray-300 pl-4" },
    { text: "", delay: 100 },
    { text: "ERROR 404: Series A investors not found.", style: "text-red-400 italic" },
    { text: "", delay: 300 },
    { text: "THIS IS THE WAY.", style: "text-white font-bold text-xl tracking-widest mt-4" },
];

export const OriginModal: React.FC<OriginModalProps> = ({ isOpen, onClose }) => {
    const [displayedLines, setDisplayedLines] = useState<TerminalLine[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setDisplayedLines([]);
            setCurrentLineIndex(0);
            setCurrentCharIndex(0);
            setIsTyping(true);
        }
    }, [isOpen]);

    // Typing Logic
    useEffect(() => {
        if (!isOpen || !isTyping) return;

        if (currentLineIndex >= CONTENT.length) {
            setIsTyping(false);
            return;
        }

        const currentLine = CONTENT[currentLineIndex];

        // If line is fully typed
        if (currentCharIndex >= currentLine.text.length) {
            const timeout = setTimeout(() => {
                setDisplayedLines(prev => [...prev, currentLine]);
                setCurrentLineIndex(prev => prev + 1);
                setCurrentCharIndex(0);
            }, currentLine.delay || 30); // Default tiny pause between lines
            return () => clearTimeout(timeout);
        }

        // Type next char
        const charTimeout = setTimeout(() => {
            setCurrentCharIndex(prev => prev + 1);
        }, 15); // FAST typing speed (15ms)

        return () => clearTimeout(charTimeout);
    }, [isOpen, isTyping, currentLineIndex, currentCharIndex]);

    if (!isOpen) return null;

    // Current line being typed (not yet in displayedLines)
    const activeLineText = CONTENT[currentLineIndex]?.text.substring(0, currentCharIndex) || "";
    const activeLineStyle = CONTENT[currentLineIndex]?.style || "";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* CRT Container */}
            <div className="relative z-10 w-full max-w-2xl bg-black border-2 border-[#0EA5E9] rounded-lg shadow-[0_0_30px_rgba(14,165,233,0.2)] overflow-hidden flex flex-col max-h-[90vh]">

                {/* Terminal Header */}
                <div className="bg-[#111] border-b border-[#333] p-2 flex justify-between items-center px-4">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <div className="text-[#333] font-mono text-xs">TERM_SESSION_01</div>
                </div>

                {/* Terminal Content Area */}
                <div className="p-8 font-mono text-sm md:text-base overflow-y-auto custom-scrollbar flex-1 bg-black/95">

                    {/* Rendered Lines */}
                    {displayedLines.map((line, idx) => (
                        <div key={idx} className={`mb-1 ${line.style || 'text-gray-300'} break-words`}>
                            {line.text}
                        </div>
                    ))}

                    {/* Active Typing Line */}
                    {isTyping && (
                        <div className={`mb-1 ${activeLineStyle} break-words`}>
                            {activeLineText}
                            <span className="animate-pulse inline-block w-2.5 h-4 bg-[#0EA5E9] ml-1 align-middle" />
                        </div>
                    )}

                    {/* Final Blinking Cursor when done */}
                    {!isTyping && (
                        <div className="mt-4 text-[#0EA5E9]">
                            root@attentium:~$ <span className="animate-pulse inline-block w-2.5 h-4 bg-[#0EA5E9] align-middle" />
                        </div>
                    )}
                </div>

                {/* Footer Command Bar */}
                <div className="border-t-2 border-[#333] bg-[#111] p-4 text-center">
                    <button
                        onClick={onClose}
                        className="group relative inline-flex items-center justify-center px-8 py-2 font-mono font-bold text-white transition-all duration-200 bg-black border border-white hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                    >
                        <span className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity"> &gt; </span>
                        [ X ] CLOSE_SESSION
                    </button>
                </div>

                {/* CRT Scanline Overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[len:100%_4px,3px_100%] opacity-20" />
            </div>
        </div>
    );
};
