namespace invoice;

using { cuid } from '@sap/cds/common';

entity Invoices : cuid {
    supplierinvoice  : String(100);
    fiscalyear       : String(4);
    companycode      : String(20);
    costcenter       : String(50);
    currency         : String(10);
    glaccount        : String(50);
    grandtotal       : Decimal(15,2);
    invoicedate      : Date;
    invoicetype      : String(50);
    paymentterms     : String(100);
    suppliername     : String(255);
    suppliervendorid : String(100);
    taxamount        : Decimal(15,2);
    taxcode          : String(50);
    taxrate          : Decimal(5,2);
    taxableamount    : Decimal(15,2);
}