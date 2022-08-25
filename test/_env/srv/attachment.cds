namespace attachment;

using { managed, cuid } from '@sap/cds/common';

entity AttachmentFolder: cuid, managed {
    name: String;
    attachments: Association to many Attachment on attachments.folder = $self;
}

entity Attachment: cuid {
    folder: Association to AttachmentFolder;
    @Core.MediaType: imageType
    file: LargeBinary;
    @Core.IsMediaType
    imageType: String;
}

service AttachmentService {

    entity AttachmentFolder as projection on attachment.AttachmentFolder;
    entity Attachment as projection on attachment.Attachment;
}