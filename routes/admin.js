import { Router } from "express";
import { doctor } from "../models/doctor.js";

const router = Router();

// Admin dashboard
router.get("/", async (req, res) => {
  try {
    const pendingDoctors = await doctor.find({ status: "pending" }) || [];
    const approvedDoctors = await doctor.find({ status: "approved" }) || [];
    
    const approvedDoctorsCount = await doctor.countDocuments({ status: "approved" }) || 0;
    const rejectedDoctorsCount = await doctor.countDocuments({ status: "rejected" }) || 0;
    const totalDoctorsCount = await doctor.countDocuments() || 0;

    res.render("admin", {
      pendingDoctors,
      approvedDoctors,
      approvedDoctorsCount,
      rejectedDoctorsCount,
      totalDoctorsCount,
    });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.status(500).send("Error loading dashboard");
  }
});

// Get doctor details for modal
router.get('/doctor-details/:doctorid', async (req, res) => {
  try {
    const doctorId = req.params.doctorid;
    const foundDoctor = await doctor.findOne({ doctorid: doctorId }).select('-passwordHash');
    
    if (!foundDoctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }
    
    res.json({
      success: true,
      doctor: foundDoctor
    });
  } catch (error) {
    console.error("Error fetching doctor details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching doctor details"
    });
  }
});

// Approve doctor
router.get('/approve-doctor/:doctorid', async (req, res) => {
  const doctorID = req.params.doctorid;
  try {
    await doctor.findOneAndUpdate(
      { doctorid: doctorID }, 
      { 
        $set: { 
          status: "approved",
          licenseVerified: true // Mark license as verified when approved
        } 
      },
      { new: true }
    );
    
    // In a real application, you might want to send an email notification here
    // await sendApprovalEmail(doctorID);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Doctor Approved</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="min-h-screen flex items-center justify-center bg-gray-100">
        <div class="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-green-600 text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800 mb-2">Doctor Approved Successfully!</h1>
          <p class="text-gray-600 mb-6">The doctor has been approved and can now access the system.</p>
          <a href="/adminPage" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Return to Dashboard
          </a>
        </div>
        <script>
          setTimeout(() => {
            window.location.href = '/adminPage';
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (e) {
    console.log(e);
    res.status(500).send("Error approving doctor");
  }
});

// Reject doctor
router.get('/reject-doctor/:doctorid', async (req, res) => {
  const doctorID = req.params.doctorid;
  try {
    // Get doctor details before deleting (for potential notification)
    const doctorDetails = await doctor.findOne({ doctorid: doctorID });
    
    await doctor.findOneAndDelete({ doctorid: doctorID });

    if (!doctorDetails) {
      return res.status(404).send("Doctor not found");
    }

    // In a real application, you might want to send a rejection email here
    // await sendRejectionEmail(doctorDetails.email);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Doctor Rejected</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="min-h-screen flex items-center justify-center bg-gray-100">
        <div class="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-times text-red-600 text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800 mb-2">Doctor Rejected</h1>
          <p class="text-gray-600 mb-6">The doctor application has been rejected and removed from the system.</p>
          <a href="/adminPage" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Return to Dashboard
          </a>
        </div>
        <script>
          setTimeout(() => {
            window.location.href = '/adminPage';
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error while rejecting doctor");
  }
});

export const adminRouter = router;