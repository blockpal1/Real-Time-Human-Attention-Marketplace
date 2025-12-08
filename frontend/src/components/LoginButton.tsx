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
            className="px-4 py-2 bg-purple-600 border border-purple-500 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-all hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]"
        >
            Universal Login
        </button>
    );
};
