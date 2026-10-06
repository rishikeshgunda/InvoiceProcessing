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
            `Authentication failed (${response.status}): ${error}`
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

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

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
                'Completed job response:'
            );

            console.log(
                JSON.stringify(job, null, 2)
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


export default cds.service.impl(function () {

    console.log('InvoiceService initialized');

    const app = cds.app;

    app.post(
        '/invoice/upload',
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


                // 1. Authenticate with Document AI

                const accessToken = await getAccessToken();

                console.log(
                    'Document AI authentication successful'
                );


                // 2. Find template dynamically

                const template = await getTemplate(
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


                // 3. Submit document for processing

                const job = await processDocument(
                    accessToken,
                    template,
                    req.file
                );

                const jobId = job.id;

                console.log(
                    `Document AI job created: ${jobId}`
                );


                // 4. Wait until Document AI finishes processing

                const completedJob = await waitForJob(
                    accessToken,
                    jobId
                );


                // 5. Return the completed job response

                return res.status(200).json({

                    message: 'Document processed successfully',

                    filename: req.file.originalname,

                    template: {
                        id: template.id,
                        name: template.name,
                        schemaId: template.schemaId,
                        schemaName: template.schemaName,
                        clientId: template.clientId
                    },

                    job: completedJob

                });

            } catch (error) {

                console.error(
                    'Document AI error:',
                    error.message
                );

                return res.status(500).json({

                    error: 'Document AI processing failed',

                    details: error.message

                });
            }
        }
    );

});