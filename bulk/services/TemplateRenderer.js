class TemplateRenderer {
    // Sanitize variable values to prevent injection
    static sanitizeValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        // Convert to string and remove any null bytes
        const str = String(value).replace(/\0/g, '');
        
        // Limit length to prevent abuse
        if (str.length > 1000) {
            return str.substring(0, 1000) + '...';
        }
        
        return str;
    }

    // Extract variables from template body
    static extractVariables(body) {
        const matches = body.match(/\{\{([^}]+)\}\}/g);
        if (!matches) return [];
        
        return [...new Set(matches.map(match => 
            match.replace(/[{}]/g, '').trim()
        ))];
    }

    // Render template with variables and spintext
    static render(template, variables = {}, options = {}) {
        let rendered = template;
        
        // Replace variables with sanitized values
        Object.keys(variables).forEach(key => {
            const sanitizedValue = this.sanitizeValue(variables[key]);
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            rendered = rendered.replace(regex, sanitizedValue);
        });

        // Handle spintext if enabled
        if (options.spintext) {
            rendered = this.processSpintext(rendered);
        }

        return rendered;
    }

    // Process spintext: {option1|option2|option3}
    static processSpintext(text) {
        return text.replace(/\{([^}]+)\}/g, (match, content) => {
            // Skip if it looks like a template variable
            if (content.includes('{{') || content.includes('}}')) {
                return match;
            }
            
            const options = content.split('|').map(opt => opt.trim());
            return options[Math.floor(Math.random() * options.length)];
        });
    }

    // Preview template with sample data
    static preview(template, sampleData = [], count = 3) {
        const previews = [];
        
        for (let i = 0; i < Math.min(count, sampleData.length || 1); i++) {
            const data = sampleData[i] || {};
            const rendered = this.render(template, data, { spintext: true });
            previews.push({
                data,
                rendered,
                variables: this.extractVariables(template)
            });
        }
        
        return previews;
    }

    // Validate template
    static validate(template, requiredFields = []) {
        const variables = this.extractVariables(template);
        const missing = requiredFields.filter(field => !variables.includes(field));
        
        return {
            isValid: missing.length === 0,
            variables,
            missing,
            hasSpintext: /\{[^}]*\|[^}]*\}/.test(template)
        };
    }
}

module.exports = TemplateRenderer;
