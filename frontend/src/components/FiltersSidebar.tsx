import React from 'react';

export const FiltersSidebar: React.FC = () => {
    return (
        <div style={{
            width: '250px',
            padding: '20px',
            borderRight: '1px solid #333',
            background: '#131620'
        }}>
            <h3 style={{ color: 'white' }}>Filters</h3>

            <div style={{ margin: '20px 0' }}>
                <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Task Type</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['Meme', 'Doc', 'Video'].map(t => (
                        <div key={t} style={{
                            padding: '4px 8px',
                            background: '#222',
                            borderRadius: '4px',
                            color: '#ccc',
                            fontSize: '0.9em',
                            cursor: 'pointer'
                        }}>{t}</div>
                    ))}
                </div>
            </div>

            <div style={{ margin: '20px 0' }}>
                <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Verified Only</label>
                <input type="checkbox" defaultChecked /> <span style={{ color: '#ccc' }}>Show verified humans</span>
            </div>
        </div>
    );
};
