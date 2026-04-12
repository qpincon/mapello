(function () {
    // Get the current script element
    const currentScript = document.currentScript || document.querySelector('script[data-svg-path]');

    if (!currentScript) {
        console.error('SVG Loader: Could not find script element');
        return;
    }

    // Read configuration from data attributes
    const svgPath = currentScript.getAttribute('data-svg-path');
    const containerId = currentScript.getAttribute('data-target-container-id');

    if (!svgPath || !containerId) {
        console.error('SVG Loader: Missing required attributes (data-svg-path or data-target-container-id)');
        return;
    }

    // Function to load and insert SVG
    async function loadSVG() {
        try {
            // Fetch the SVG file
            const response = await fetch(svgPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch SVG: ${response.status}`);
            }

            const svgText = await response.text();

            // Parse the SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;

            // Check for parsing errors
            const parserError = svgDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('SVG parsing error');
            }

            // Extract and execute scripts from SVG
            const scripts = svgElement.querySelectorAll('script');
            const scriptContents = [];

            scripts.forEach(script => {
                scriptContents.push(script.textContent);
                script.remove(); // Remove from SVG
            });

            // Wait for DOM to be ready
            const insertSVG = () => {
                // Insert SVG
                document.getElementById(containerId).innerHTML = svgText;

                // Find and execute scripts
                const container = document.getElementById(containerId);
                const scripts = container.querySelectorAll('script');

                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    newScript.textContent = oldScript.textContent;

                    // Copy attributes if needed
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });

                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            };

            // Insert when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', insertSVG);
            } else {
                insertSVG();
            }

        } catch (error) {
            console.error('SVG Loader: Error loading SVG:', error);
        }
    }

    // Start loading
    loadSVG();
})();