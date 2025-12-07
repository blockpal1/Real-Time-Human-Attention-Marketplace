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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
            Log in
        </button>
    );
};
