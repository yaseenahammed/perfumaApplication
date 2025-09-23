const nodemailer = require('nodemailer');
const logger = require('../../helpers/logger');
const Contact = require('../../models/contactSchema');  // ✅ import

const getAbout = async (req, res) => {
  try {
    res.render('about',{
        title:'about'
    });
  } catch (error) {
    logger.error('Error getting about page', error);
  }
};

const getContact = async (req, res) => {
  try {
    res.render('contact',{
        title:'contact'
    });
  } catch (error) {
    logger.error('Error getting contact page', error);
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

const postContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, message: 'All fields are required' });
    }

   
    const newContact = await Contact.create({ name, email, subject, message });

    await transporter.sendMail({
      from: `"Perfuma Contact" <${process.env.NODEMAILER_EMAIL}>`,
      replyTo: email,
      to: 'infoperfuma0@gmail.com',
      subject: `New Contact Form Submission: ${subject}`,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Subject:</strong> ${subject}</p>
             <p><strong>Message:</strong> ${message}</p>`,
    });

    res.json({ success: true, data: newContact });
  } catch (error) {
    logger.error('Error handling contact form submission:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAbout,
  getContact,
  postContact,
};
