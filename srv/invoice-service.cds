using { invoice as db } from '../db/schema';

@path: '/invoice'
service InvoiceService {

    entity Invoices as projection on db.Invoices;

}