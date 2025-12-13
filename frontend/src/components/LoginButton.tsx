import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

export const LoginButton: React.FC = () => {
    const { login, authenticated } = usePrivy();

    if (authenticated) {
        return null;
    }

    return (
        <button
            onClick={login}
            className="px-4 py-2 bg-[#0EA5E9] border border-[#38BDF8] hover:bg-[#0284C7] text-white text-xs font-bold uppercase tracking-wider rounded transition-all hover:shadow-[0_0_15px_rgba(14,165,233,0.5)]"
        >
            Login
        </button>
    );
};
