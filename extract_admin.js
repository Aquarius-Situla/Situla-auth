const fs = require('fs');
let html = fs.readFileSync('public/admin.html', 'utf8');

// Update simplewebauthn link
html = html.replace('https://unpkg.com/@simplewebauthn/browser@9.0.1/dist/bundle/index.umd.min.js', '/js/simplewebauthn.js');

// Extract script
const startTag = '<script>\n        const { startRegistration }';
const endTag = '    </script>\n</body>';

const scriptStart = html.indexOf(startTag);
const scriptEnd = html.indexOf(endTag);

if (scriptStart !== -1 && scriptEnd !== -1) {
    const scriptContent = html.substring(scriptStart + 9, scriptEnd);
    fs.writeFileSync('public/js/admin.js', scriptContent);
    
    html = html.substring(0, scriptStart) + '<script src="/js/admin.js"></script>\n' + html.substring(scriptEnd + 14);
    fs.writeFileSync('public/admin.html', html);
    console.log('Successfully extracted admin.js and updated admin.html');
} else {
    console.error('Could not find script bounds');
}
