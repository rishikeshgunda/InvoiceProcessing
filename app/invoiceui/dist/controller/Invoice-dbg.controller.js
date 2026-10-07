sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Controller, MessageToast, MessageBox) => {

    "use strict";


    return Controller.extend(
        "com.invoiceui.invoiceui.controller.Invoice",
        {


            // ========================================================
            // CONTROLLER INITIALIZATION
            // ========================================================

            onInit() {

                // Store the selected PDF file here.
                this._selectedFile = null;

            },

            // Controller initialization complete.
            // ========================================================



            // ========================================================
            // FILE SELECTION
            // ========================================================

            onFileChange(oEvent) {

                const file =
                    oEvent.getParameter("files")[0];


                // No file selected.
                if (!file) {

                    this._selectedFile = null;

                    this.byId(
                        "uploadButton"
                    ).setEnabled(false);

                    return;
                }


                // Only PDF invoices are allowed.
                if (file.type !== "application/pdf") {

                    MessageBox.error(
                        "Please select a PDF invoice."
                    );


                    this._selectedFile = null;


                    this.byId(
                        "uploadButton"
                    ).setEnabled(false);


                    return;
                }


                // Store selected file.
                this._selectedFile = file;


                // Enable upload button.
                this.byId(
                    "uploadButton"
                ).setEnabled(true);


                // Hide previous status.
                this.byId(
                    "statusMessage"
                ).setVisible(false);


                MessageToast.show(
                    `Selected file: ${file.name}`
                );
            },

            // File selection handling complete.
            // ========================================================



            // ========================================================
            // UPLOAD INVOICE
            // ========================================================

            async onUpload() {

                // Make sure a file was selected.
                if (!this._selectedFile) {

                    MessageBox.warning(
                        "Please select an invoice PDF first."
                    );

                    return;
                }


                const uploadButton =
                    this.byId("uploadButton");


                const statusMessage =
                    this.byId("statusMessage");


                // Prevent another upload while processing.
                uploadButton.setEnabled(false);


                statusMessage.setText(
                    "Processing invoice. Please wait..."
                );


                statusMessage.setType(
                    "Information"
                );


                statusMessage.setVisible(
                    true
                );


                try {

                    // ====================================================
                    // CREATE MULTIPART FORM DATA
                    // ====================================================

                    const formData =
                        new FormData();


                    formData.append(
                        "file",
                        this._selectedFile,
                        this._selectedFile.name
                    );


                    // ====================================================
                    // CALL CAP UPLOAD ENDPOINT
                    // ====================================================

                    const response =
                        await fetch(
                            "/invoice/upload",
                            {
                                method: "POST",
                                body: formData
                            }
                        );


                    // Handle HTTP errors.
                    if (!response.ok) {

                        const errorText =
                            await response.text();


                        throw new Error(
                            errorText ||
                            `Upload failed (${response.status})`
                        );
                    }


                    // ====================================================
                    // READ CAP RESPONSE
                    // ====================================================

                    const result =
                        await response.json();


                    console.log(
                        "CAP invoice processing response:",
                        result
                    );


                    // ====================================================
                    // DISPLAY EXTRACTED INVOICE
                    // ====================================================

                    this._displayResult(
                        result
                    );


                    // ====================================================
                    // SUCCESS MESSAGE
                    // ====================================================

                    statusMessage.setText(
                        "Invoice processed and workflow started successfully."
                    );


                    statusMessage.setType(
                        "Success"
                    );


                    MessageToast.show(
                        "Invoice processed successfully"
                    );


                } catch (error) {

                    // ====================================================
                    // ERROR HANDLING
                    // ====================================================

                    console.error(
                        "Invoice upload error:",
                        error
                    );


                    statusMessage.setText(
                        "Invoice processing failed."
                    );


                    statusMessage.setType(
                        "Error"
                    );


                    MessageBox.error(
                        error.message ||
                        "Unable to process the invoice."
                    );


                } finally {

                    // Re-enable upload button.
                    uploadButton.setEnabled(
                        true
                    );
                }
            },

            // Invoice upload handling complete.
            // ========================================================



            // ========================================================
            // DISPLAY INVOICE RESULT
            // ========================================================

            _displayResult(result) {

                // CAP now returns:
                //
                // {
                //     message: "...",
                //     filename: "...",
                //     invoice: {
                //         supplierName: "...",
                //         ...
                //     },
                //     bpa: {
                //         status: 201,
                //         result: {...}
                //     }
                // }
                //
                // Therefore we directly use result.invoice.

                const values =
                    result?.invoice || {};


                console.log(
                    "Extracted invoice:",
                    values
                );


                // ====================================================
                // SET EXTRACTED VALUES
                // ====================================================

                this.byId(
                    "supplierName"
                ).setText(
                    values.supplierName || ""
                );


                this.byId(
                    "supplierVendorId"
                ).setText(
                    values.supplierVendorId || ""
                );


                this.byId(
                    "invoiceNumber"
                ).setText(
                    values.invoiceNumber || ""
                );


                this.byId(
                    "invoiceDate"
                ).setText(
                    values.invoiceDate || ""
                );


                this.byId(
                    "companyCode"
                ).setText(
                    values.companyCode || ""
                );


                this.byId(
                    "invoiceType"
                ).setText(
                    values.invoiceType || ""
                );


                this.byId(
                    "currency"
                ).setText(
                    values.currency || ""
                );


                this.byId(
                    "taxableAmount"
                ).setText(
                    values.taxableAmount || ""
                );


                this.byId(
                    "taxAmount"
                ).setText(
                    values.taxAmount || ""
                );


                this.byId(
                    "taxRate"
                ).setText(
                    values.taxRate || ""
                );


                this.byId(
                    "grandTotal"
                ).setText(
                    values.grandTotal || ""
                );


                this.byId(
                    "paymentTerms"
                ).setText(
                    values.paymentTerms || ""
                );


                this.byId(
                    "glAccount"
                ).setText(
                    values.glAccount || ""
                );


                this.byId(
                    "costCenter"
                ).setText(
                    values.costCenter || ""
                );


                this.byId(
                    "taxCode"
                ).setText(
                    values.taxCode || ""
                );


                // Show extracted invoice panel.
                this.byId(
                    "resultPanel"
                ).setVisible(true);
            }

            // Invoice result display complete.
            // ========================================================

        }
    );
});