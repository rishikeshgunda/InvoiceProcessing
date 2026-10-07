import cds from '@sap/cds';
import multer from 'multer';
import 'dotenv/config';

const upload = multer({
    storage: multer.memoryStorage()
});

async function getAccessToken() {
    const credentials = Buffer
        .from(
            `${process.env.DOCUMENT_AI_CLIENT_ID}:${process.env.DOCUMENT_AI_CLIENT_SECRET}`
        )
        .toString('base64');

    const response = await fetch(
        `${process.env.DOCUMENT_AI_AUTH_URL}/oauth/token`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `Document AI authentication failed (${response.status}): ${error}`
        );
    }

    const data = await response.json();

    return data.access_token;
}

async function getTemplate(accessToken) {
    const response = await fetch(
        `${process.env.DOCUMENT_AI_URL}/document-information-extraction/v1/templates?clientId=${encodeURIComponent(
            process.env.DOCUMENT_AI_TEMPLATE_CLIENT_ID
        )}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `Template lookup failed (${response.status}): ${error}`
        );
    }

    const data = await response.json();

    const templates = data.results || [];

    const template = templates.find(
        item => item.name === process.env.DOCUMENT_AI_TEMPLATE_NAME
    );

    if (!template) {
        throw new Error(
            `Template '${process.env.DOCUMENT_AI_TEMPLATE_NAME}' not found`
        );
    }

    return template;
}

async function processDocument(accessToken, template, file) {
    const formData = new FormData();

    const pdfBlob = new Blob(
        [file.buffer],
        {
            type: file.mimetype
        }
    );

    formData.append(
        'file',
        pdfBlob,
        file.originalname
    );

    const options = {
        clientId: template.clientId,
        documentType: template.documentType,
        schemaId: template.schemaId,
        templateId: template.id
    };

    formData.append(
        'options',
        JSON.stringify(options)
    );

    const response = await fetch(
        `${process.env.DOCUMENT_AI_URL}/document-information-extraction/v1/document/jobs`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            body: formData
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `Document processing failed (${response.status}): ${error}`
        );
    }

    return await response.json();
}

async function waitForJob(accessToken, jobId) {
    const maxAttempts = 15;
    const interval = 2000;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {
        console.log(
            `Checking job status (${attempt}/${maxAttempts})...`
        );

        const response = await fetch(
            `${process.env.DOCUMENT_AI_URL}/document-information-extraction/v1/document/jobs/${jobId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const error = await response.text();

            throw new Error(
                `Job status request failed (${response.status}): ${error}`
            );
        }

        const job = await response.json();

        console.log(
            `Job ${jobId} status: ${job.status}`
        );

        if (job.status === 'DONE') {
            console.log(
                'Document AI processing completed.'
            );

            return job;
        }

        if (
            job.status === 'FAILED' ||
            job.status === 'ERROR'
        ) {
            throw new Error(
                `Document AI job failed with status: ${job.status}`
            );
        }

        await new Promise(
            resolve => setTimeout(resolve, interval)
        );
    }

    throw new Error(
        'Document AI job timed out after 30 seconds'
    );
}

function extractInvoiceFields(job) {
    const fields = {};

    const headerFields =
        job?.extraction?.headerFields || [];

    for (const field of headerFields) {
        fields[field.name] =
            field.value ?? "";
    }

    return fields;
}

async function getBpaAccessToken() {
    const credentials = Buffer
        .from(
            `${process.env.BPA_CLIENT_ID}:${process.env.BPA_CLIENT_SECRET}`
        )
        .toString('base64');

    const response = await fetch(
        `${process.env.BPA_AUTH_URL}/oauth/token?grant_type=client_credentials`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `BPA authentication failed (${response.status}): ${error}`
        );
    }

    const data = await response.json();

    return data.access_token;
}

async function triggerBpa(accessToken, invoice) {
    const payload = {
        definitionId:
            process.env.BPA_DEFINITION_ID,

        context: {
            supplierinvoice:
                invoice.invoiceNumber || "",

            fiscalyear:
                invoice.invoiceDate
                    ? invoice.invoiceDate.substring(0, 4)
                    : "",

            companycode:
                invoice.companyCode || "",

            costcenter:
                invoice.costCenter || "",

            currency:
                invoice.currency || "",

            glaccount:
                invoice.glAccount || "",

            grandtotal:
                invoice.grandTotal || "",

            invoicedate:
                invoice.invoiceDate
                    ? `${invoice.invoiceDate}T00:00:00Z`
                    : "",

            invoicetype:
                invoice.invoiceType || "",

            paymentterms:
                invoice.paymentTerms || "",

            suppliername:
                invoice.supplierName || "",

            suppliervendorid:
                invoice.supplierVendorId || "",

            taxamount:
                invoice.taxAmount || "",

            taxcode:
                invoice.taxCode || "",

            taxrate:
                invoice.taxRate || "",

            taxableamount:
                invoice.taxableAmount || ""
        }
    };

    console.log(
        'Starting BPA workflow...'
    );

    const response = await fetch(
        `${process.env.BPA_API_URL}/workflow/rest/v1/workflow-instances`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }
    );

    if (!response.ok) {
        const error = await response.text();

        throw new Error(
            `BPA workflow start failed (${response.status}): ${error}`
        );
    }

    const responseText = await response.text();

    let result = null;

    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            result = {
                response: responseText
            };
        }
    }

    return {
        status: response.status,
        result
    };
}

export default cds.service.impl(function () {
    console.log(
        'InvoiceService initialized'
    );

    const app = cds.app;

    app.post(
        '/upload',
        upload.single('file'),
        async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        error: 'No file uploaded'
                    });
                }

                console.log(
                    `File received: ${req.file.originalname}`
                );

                const accessToken =
                    await getAccessToken();

                console.log(
                    'Document AI authentication successful'
                );

                const template =
                    await getTemplate(
                        accessToken
                    );

                console.log(
                    `Template found: ${template.name}`
                );

                console.log(
                    `Template ID: ${template.id}`
                );

                console.log(
                    `Schema ID: ${template.schemaId}`
                );

                const job =
                    await processDocument(
                        accessToken,
                        template,
                        req.file
                    );

                const jobId =
                    job.id;

                console.log(
                    `Document AI job created: ${jobId}`
                );

                const completedJob =
                    await waitForJob(
                        accessToken,
                        jobId
                    );

                const invoice =
                    extractInvoiceFields(
                        completedJob
                    );

                console.log(
                    'Extracted invoice fields:'
                );

                console.log(
                    JSON.stringify(
                        invoice,
                        null,
                        2
                    )
                );

                const bpaAccessToken =
                    await getBpaAccessToken();

                console.log(
                    'BPA authentication successful'
                );

                const bpaResult =
                    await triggerBpa(
                        bpaAccessToken,
                        invoice
                    );

                console.log(
                    'BPA workflow started successfully.'
                );

                return res.status(200).json({
                    message:
                        'Invoice processed and BPA workflow started successfully.',

                    filename:
                        req.file.originalname,

                    invoice,

                    bpa: bpaResult
                });

            } catch (error) {
                console.error(
                    'Invoice processing error:',
                    error
                );

                return res.status(500).json({
                    error:
                        'Invoice processing failed',

                    details:
                        error.message
                });
            }
        }
    );

    console.log(
        'POST /upload endpoint registered'
    );
});