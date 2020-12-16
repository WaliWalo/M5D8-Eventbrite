const express = require("express");
const { getAttendees, writeAttendees } = require("../../fsUtilities");
const uniqid = require("uniqid");
const attendeesRouter = express.Router();
const joi = require("joi");
const sgMail = require("@sendgrid/mail");
const { Transform } = require("json2csv");
const { pipeline } = require("stream");
const { join } = require("path");
const { createReadStream } = require("fs-extra");

let PdfPrinter = require("pdfmake");
let fonts = {
  Roboto: {
    normal: join(__dirname, "./fonts/Roboto-Regular.ttf"),
    bold: join(__dirname, "./fonts/Roboto-Medium.ttf"),
    italics: join(__dirname, "./fonts/Roboto-Italic.ttf"),
    bolditalics: join(__dirname, "./fonts/Roboto-Italic.ttf"),
  },
};
let printer = new PdfPrinter(fonts);

const validateAttendeeInput = (dataToValidate) => {
  const schema = joi.object().keys({
    firstName: joi.string().min(3).max(30).required(),
    secondName: joi.string().min(3).max(30).required(),
    email: joi
      .string()
      .email({
        minDomainSegments: 2,
        tlds: { allow: ["com", "net"] },
      })
      .required(),
    arrivalTime: joi.string().required(),
  });

  console.log(schema.validate(dataToValidate));
  return schema.validate(dataToValidate); //error,value
};
//- POST /attendees/ => add a new participant to the event.  Attendees' data will include:
// - ID
// - First Name
// - Second Name
// - Email
// - Time of Arrival (a string is ok)
// After successfully saving the participant in an attendees.json file on disk, backend will send an email to that participant's mail address
// `/attendees` POST a new attendee to attendees.json
attendeesRouter.post("/", async (req, res, next) => {
  try {
    const { error } = validateAttendeeInput(req.body);
    if (error) {
      let err = new Error();
      err.message = error.details[0].message;
      err.httpStatusCode = 400;
      next(err);
    } else {
      let newAttendees = {
        ...req.body,
        _id: uniqid(),
        createdAt: new Date(),
      };
      let attendeeDB = await getAttendees();
      attendeeDB.push(newAttendees);
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to: ` ${newAttendees.email}`,
        from: "hungjinchong@outlook.com",
        subject: "PLEASE WEAR SOMETHING NICE",
        text: `Dear ${newAttendees.firstName}, \n\n Come with gifts please. Thank you very much. \n\n Best Regards,\nJin`,
        html: "<strong>and easy to do anywhere, even with Node.js</strong>",
      };
      console.log(msg);
      await sgMail.send(msg);
      await writeAttendees(attendeeDB);
      res.status(201).send(newAttendees);
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

//- GET /attendees/csv => this route must return full list of attendees exported as a CSV file (use stream from json2csv npm module)
attendeesRouter.get("/csv", async (req, res, next) => {
  try {
    const attendeesPath = join(__dirname, "./attendees.json");
    const jsonReadableStream = createReadStream(attendeesPath); //source
    //source -> transform to csv -> to user
    const json2csv = new Transform({
      fields: ["_id", "firstName", "secondName", "email", "arrivalTime"],
    });
    //to prompt where to save file
    res.setHeader("Content-Disposition", "attachment; filename=attendees.csv");
    pipeline(jsonReadableStream, json2csv, res, (err) => {
      if (err) {
        console.log(err);
        next(err);
      } else {
        console.log("Done");
      }
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

//- POST /attendees/:id/createPDF => this route needs to generate a PDF document and save it to the disk. The document needs to contain data belonging
// to the attendee with the specified id
attendeesRouter.get("/:id/createPDF", async (req, res, next) => {
  try {
    const attendeesDB = await getAttendees();
    const attendee = attendeesDB.filter((attendee) => {
      return attendee._id === req.params.id;
    });

    if (attendee) {
      // and you pass the doc-definition-object to createPdfKitDocument method
      let docDefinition = {
        content: [
          "First paragraph",
          "Another paragraph, this time a little bit longer to make sure, this line will be divided into at least two lines",
        ],
      };
      let pdfDoc = printer.createPdfKitDocument(docDefinition);

      // pdfDoc is a stream so you can pipe it to the file system
      let fs = require("fs");
      pdfDoc.pipe(fs.createWriteStream("basics.pdf"));
      pdfDoc.end();
      //   const attendeesPath = join(__dirname, "./attendees.json");
      //   const jsonReadableStream = createReadStream(attendeesPath);
      //   res.setHeader(
      //     "Content-Disposition",
      //     "attachment; filename=attendees.csv"
      //   );
      //   let pdf = pdfMake.createPdf(attendeesDB);
      //   pipeline(jsonReadableStream, pdf, res, (err) => {
      //     if (err) {
      //       console.log(err);
      //       next(err);
      //     } else {
      //       console.log("Done");
      //       pdf.download(`pdf-${+new Date()}.pdf`);
      //     }
      //   });
      //await pdfMake.createPdf(attendeesDB).download(`pdf-${+new Date()}.pdf`);
    } else {
      let error = new Error();
      error.httpStatusCode = 404;
      next(error);
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

module.exports = attendeesRouter;
