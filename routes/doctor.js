import { Router } from "express";
import bcrypt from "bcryptjs";
import { doctor } from "../models/doctor.js";
import { appointment } from "../models/appointment.js";
import generateCode from "../services/uniqueID.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const doctorRouter = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "public");
  },
  filename: (req, file, callback) => {
    callback(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Middleware to check if doctor is logged in
const isDoctorLoggedIn = (req, res, next) => {
  if (req.session && req.session.doctorId) {
    return next();
  }
  res.redirect("/doctorLogin");
};

// Doctor Registration
doctorRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, gender, specialization, location } = req.body;

    // Check if doctor already exists
    const existingDoctor = await doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ 
        success: false, 
        message: "Doctor with this email already exists" 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate unique doctor ID
    const doctorid = generateCode();

    // Create doctor
    const newDoctor = await doctor.create({
      name,
      email,
      passwordHash,
      phone,
      gender,
      specialization: specialization.toLowerCase(),
      location: location.toLowerCase(),
      doctorid,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Doctor registered successfully! Please wait for admin approval.",
      doctorId: doctorid,
    });
  } catch (error) {
    console.error("Doctor registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering doctor: " + error.message,
    });
  }
});

// Doctor Login
doctorRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find doctor by email
    const foundDoctor = await doctor.findOne({ email });
    if (!foundDoctor) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if doctor is approved
    if (foundDoctor.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin approval.",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, foundDoctor.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Set session
    req.session.doctorId = foundDoctor.doctorid;
    req.session.doctorEmail = foundDoctor.email;

    res.json({
      success: true,
      message: "Login successful",
      doctorId: foundDoctor.doctorid,
      redirectUrl: "/doctor/dashboard",
    });
  } catch (error) {
    console.error("Doctor login error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login: " + error.message,
    });
  }
});

// Doctor Dashboard
doctorRouter.get("/dashboard", isDoctorLoggedIn, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const foundDoctor = await doctor.findOne({ doctorid: doctorId });

    if (!foundDoctor) {
      return res.redirect("/doctorLogin");
    }

    // Get all appointments for this doctor
    const appointments = await appointment
      .find({ doctorid: doctorId })
      .sort({ createdAt: -1 });

    res.render("doctorDashboard", {
      doctor: foundDoctor,
      appointments: appointments,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send("Error loading dashboard: " + error.message);
  }
});

// Get Doctor Profile (API endpoint)
doctorRouter.get("/profile", isDoctorLoggedIn, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const foundDoctor = await doctor.findOne({ doctorid: doctorId }).select("-passwordHash");
    
    if (!foundDoctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.json({ success: true, doctor: foundDoctor });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ success: false, message: "Error fetching profile" });
  }
});

// Update Doctor Profile
doctorRouter.post("/profile/update", isDoctorLoggedIn, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const { name, phone, specialization, location } = req.body;

    const updatedDoctor = await doctor.findOneAndUpdate(
      { doctorid: doctorId },
      { name, phone, specialization, location },
      { new: true }
    ).select("-passwordHash");

    res.json({
      success: true,
      message: "Profile updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile: " + error.message,
    });
  }
});

// Upload Profile Picture
doctorRouter.post("/profile/picture", isDoctorLoggedIn, upload.single("profilePicture"), async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Upload to Cloudinary
    const cloudinaryRes = await cloudinary.uploader.upload(req.file.path, {
      folder: "doctor-profiles",
    });

    // Update doctor profile picture
    const updatedDoctor = await doctor.findOneAndUpdate(
      { doctorid: doctorId },
      { profilePicture: cloudinaryRes.secure_url },
      { new: true }
    ).select("-passwordHash");

    res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      profilePicture: cloudinaryRes.secure_url,
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading profile picture: " + error.message,
    });
  }
});

// Get Appointments
doctorRouter.get("/appointments", isDoctorLoggedIn, async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    const appointments = await appointment
      .find({ doctorid: doctorId })
      .sort({ createdAt: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    console.error("Appointments fetch error:", error);
    res.status(500).json({ success: false, message: "Error fetching appointments" });
  }
});

// Confirm Appointment
doctorRouter.post("/appointments/:appointmentId/confirm", isDoctorLoggedIn, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { timeSlot, appointmentDate, confirmationMessage } = req.body;
    const doctorId = req.session.doctorId;

    // Find appointment and verify it belongs to this doctor
    const foundAppointment = await appointment.findOne({
      _id: appointmentId,
      doctorid: doctorId,
    });

    if (!foundAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Update appointment status
    foundAppointment.status = "confirmed";
    foundAppointment.timeSlot = timeSlot;
    foundAppointment.appointmentDate = appointmentDate;
    foundAppointment.confirmationMessage = confirmationMessage || 
      `Your appointment has been confirmed for ${timeSlot} on ${new Date(appointmentDate).toLocaleDateString()}`;
    
    await foundAppointment.save();

    // TODO: Send notification to patient (email/SMS)
    // For now, we'll just return success

    res.json({
      success: true,
      message: "Appointment confirmed successfully. Patient will be notified.",
      appointment: foundAppointment,
    });
  } catch (error) {
    console.error("Appointment confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Error confirming appointment: " + error.message,
    });
  }
});

// Logout
doctorRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error logging out" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// Get login page (moved to index.js for root access)

export default doctorRouter;
