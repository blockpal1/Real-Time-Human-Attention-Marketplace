import React from 'react';

interface FooterLinkProps {
    href: string;
    children: React.ReactNode;
    target?: string;
    rel?: string;
}

const FooterLink: React.FC<FooterLinkProps> = ({ href, children, target, rel }) => (
    <a
        href={href}
        target={target}
        rel={rel}
        className="text-gray-400 hover:text-[#0EA5E9] transition-colors duration-200 block"
    >
        {children}
    </a>
);

interface FooterColumnProps {
    title: string;
    children: React.ReactNode;
}

const FooterColumn: React.FC<FooterColumnProps> = ({ title, children }) => (
    <div>
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
            {title}
        </h3>
        <nav className="space-y-3 text-sm leading-relaxed">
            {children}
        </nav>
    </div>
);

// Attentium Logo for Footer
const AttentiumLogoSmall = () => (
    <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8"
    >
        <path
            d="M10 50 C 10 20, 90 20, 90 50"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="12" fill="white" />
        <path
            d="M15 55 C 15 80, 85 80, 85 55"
            stroke="#0EA5E9"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="10 4 20 4"
        />
    </svg>
);

/**
 * LandingFooter - Comprehensive 4-column footer for landing page
 */
export const LandingFooter: React.FC = () => {
    return (
        <footer className="bg-[#0a0f1a] border-t border-[#1e293b]">
            {/* Main Footer Content */}
            <div className="max-w-6xl mx-auto px-6 py-20">

                {/* Logo + Wordmark */}
                <div className="flex items-center gap-3 mb-16">
                    <img
                        src="/attentium-logo.png"
                        alt="Attentium Logo"
                        className="w-10 h-10"
                    />
                    <span className="text-white font-semibold text-lg tracking-wide">
                        Attentium
                    </span>
                </div>

                {/* Footer Columns */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">

                    {/* Product */}
                    <FooterColumn title="Product">
                        <FooterLink href="#how-it-works">How It Works</FooterLink>
                        <FooterLink href="#privacy">Privacy & Security</FooterLink>
                        <FooterLink href="#app">Set Your Rate</FooterLink>
                        <FooterLink href="#faq">FAQ</FooterLink>
                    </FooterColumn>

                    {/* Resources */}
                    <FooterColumn title="Resources">
                        <FooterLink href="#">Documentation</FooterLink>
                        <FooterLink href="#">API Reference</FooterLink>
                        <FooterLink href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</FooterLink>
                        <FooterLink href="#">Whitepaper</FooterLink>
                    </FooterColumn>

                    {/* Community */}
                    <FooterColumn title="Community">
                        <FooterLink href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                                Twitter
                            </span>
                        </FooterLink>
                        <FooterLink href="https://discord.com" target="_blank" rel="noopener noreferrer">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                                </svg>
                                Discord
                            </span>
                        </FooterLink>
                        <FooterLink href="#">Blog</FooterLink>
                    </FooterColumn>

                    {/* Company */}
                    <FooterColumn title="Company">
                        <FooterLink href="#">About</FooterLink>
                        <FooterLink href="#">Contact</FooterLink>
                        <FooterLink href="#">Careers</FooterLink>
                    </FooterColumn>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="border-t border-[#1e293b]">
                <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-gray-500">
                        <span>© 2024 Attentium</span>
                        <span>•</span>
                        <a href="#" className="hover:text-[#0EA5E9] transition-colors">Privacy Policy</a>
                        <span>•</span>
                        <a href="#" className="hover:text-[#0EA5E9] transition-colors">Terms of Service</a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Built on</span>
                        <svg className="w-4 h-4" viewBox="0 0 128 128" fill="currentColor">
                            <path d="M93.94 42.63l-13-22.52a4.26 4.26 0 00-3.68-2.13H50.74a4.26 4.26 0 00-3.68 2.13l-13 22.52a4.26 4.26 0 000 4.26l13 22.52a4.26 4.26 0 003.68 2.13h26.52a4.26 4.26 0 003.68-2.13l13-22.52a4.26 4.26 0 000-4.26z" fill="#9945FF" />
                        </svg>
                        <span className="text-[#9945FF]">Solana</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;
