const csv = require('csv-parser');
const { Readable } = require('stream');

class AudienceImporter {
    static async parseCSV(csvData) {
        return new Promise((resolve, reject) => {
            const results = [];
            const stream = Readable.from([csvData]);
            
            stream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    }

    static parsePasteData(pasteData) {
        const lines = pasteData.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split('\t').map(h => h.trim());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            rows.push(row);
        }

        return rows;
    }

    static validatePhone(phone) {
        if (!phone) return { isValid: false, reason: 'empty' };
        
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        
        // Check if it's a valid length (Indian mobile: 10 digits, with country code: 12)
        if (cleaned.length < 10 || cleaned.length > 15) {
            return { isValid: false, reason: 'invalid_length' };
        }

        // Indian mobile number validation
        if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
            return { isValid: true, normalized: `+91${cleaned}` };
        }
        
        // International format
        if (cleaned.length > 10) {
            return { isValid: true, normalized: `+${cleaned}` };
        }

        return { isValid: false, reason: 'invalid_format' };
    }

    static async processImport(data, columnMapping, dndList = []) {
        const results = {
            total: data.length,
            valid: 0,
            invalid: 0,
            duplicates: 0,
            dndSuppressed: 0,
            processed: []
        };

        const phoneSet = new Set();
        const dndSet = new Set(dndList.map(phone => phone.toLowerCase()));

        for (const row of data) {
            const processedRow = {
                original: row,
                phone: null,
                name: null,
                customFields: {},
                tags: [],
                consentStatus: 'unknown',
                errors: []
            };

            // Extract phone
            const phoneField = columnMapping.phone;
            if (phoneField && row[phoneField]) {
                const phoneValidation = this.validatePhone(row[phoneField]);
                if (phoneValidation.isValid) {
                    processedRow.phone = phoneValidation.normalized;
                } else {
                    processedRow.errors.push(`Invalid phone: ${phoneValidation.reason}`);
                }
            } else {
                processedRow.errors.push('Phone number missing');
            }

            // Check for duplicates
            if (processedRow.phone) {
                const phoneLower = processedRow.phone.toLowerCase();
                if (phoneSet.has(phoneLower)) {
                    processedRow.errors.push('Duplicate phone number');
                    results.duplicates++;
                } else {
                    phoneSet.add(phoneLower);
                }

                // Check DND
                if (dndSet.has(phoneLower)) {
                    processedRow.errors.push('Phone in DND list');
                    results.dndSuppressed++;
                }
            }

            // Extract name
            if (columnMapping.name && row[columnMapping.name]) {
                processedRow.name = row[columnMapping.name].trim();
            }

            // Extract consent status
            if (columnMapping.consentStatus && row[columnMapping.consentStatus]) {
                const consent = row[columnMapping.consentStatus].toLowerCase();
                if (['opted_in', 'unknown', 'opted_out'].includes(consent)) {
                    processedRow.consentStatus = consent;
                }
            }

            // Extract tags
            if (columnMapping.tags && row[columnMapping.tags]) {
                processedRow.tags = row[columnMapping.tags]
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
            }

            // Extract custom fields
            Object.keys(columnMapping).forEach(key => {
                if (!['phone', 'name', 'consentStatus', 'tags'].includes(key)) {
                    const fieldName = columnMapping[key];
                    if (fieldName && row[fieldName]) {
                        processedRow.customFields[key] = row[fieldName];
                    }
                }
            });

            // Update counters
            if (processedRow.errors.length === 0) {
                results.valid++;
            } else {
                results.invalid++;
            }

            results.processed.push(processedRow);
        }

        return results;
    }

    static generateImportSummary(results) {
        return {
            total: results.total,
            valid: results.valid,
            invalid: results.invalid,
            duplicates: results.duplicates,
            dndSuppressed: results.dndSuppressed,
            successRate: results.total > 0 ? ((results.valid / results.total) * 100).toFixed(1) : 0,
            errors: results.processed
                .filter(row => row.errors.length > 0)
                .map(row => ({
                    phone: row.original[Object.values(row.original)[0]] || 'Unknown',
                    errors: row.errors
                }))
        };
    }
}

module.exports = AudienceImporter;
