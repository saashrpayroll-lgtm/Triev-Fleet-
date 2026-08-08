
const https = require('https');

const API_KEY = '';

function listModels(version) {
    const url = `https://generativelanguage.googleapis.com/${version}/models?key=${API_KEY}`;

    console.log(`Checking ${version} models...`);

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`\n--- Response from ${version} ---`);
            console.log(`Status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    if (json.models) {
                        json.models.forEach(m => {
                            if (m.name.includes('gemini')) {
                                console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
                            }
                        });
                    } else {
                        console.log("No models property in response", data);
                    }
                } catch (e) {
                    console.log("Error parsing JSON", e);
                }
            } else {
                console.log("Error body:", data);
            }
        });
    }).on('error', (e) => {
        console.error(`Error querying ${version}:`, e);
    });
}

listModels('v1beta');
listModels('v1');
