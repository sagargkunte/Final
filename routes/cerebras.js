import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { Router } from "express";

const router = Router();

// Initialize Cerebras
const cerebras = new Cerebras({
  apiKey: "csk-vr2e85ym5tw4me5x6tvxyfeycphvxjhx93m3vrhetfmdrrjm"
  // This is the default and can be omitted
});

// Test route
router.get("/test", (req, res) => {
  res.send("test running");
});

// Render search page
router.get("/search", (req, res) => {
  res.render("search");
});

// Handle POST request to Cerebras
router.post("/search", async (req, res) => {
  try {
    const  symptoms  = req.body.query;
    console.log(symptoms); // Extract symptoms from form or JSON

    if (!symptoms) {
      return res.status(400).json({ error: "Please provide symptoms." });
    }

    const response = await cerebras.chat.completions.create({
      // You can use any supported model
      messages: [
        {
          role: "system",
          content:
            "You are a medical assistant that predicts possible diseases and doctor specializations based on symptoms."
        },
        {
          role: "user",
          content: `The user reports the following symptoms: ${symptoms}.
    Provide a clear and structured response in the following format:

    **Symptoms:** (Repeat the user’s symptoms)
    **Possible Diseases:** 
    - List 3 to 5 possible diseases based on the symptoms.
    - For each disease, include a short explanation of what it is.

    **Why It May Occur (Causes):**
    - Give possible causes or risk factors related to these diseases.

    **Recommended Doctor Specialization:**
    - Suggest the appropriate types of doctors or specialists to consult (e.g., General Physician, Dermatologist, Pulmonologist, etc.).

    **First Aid / Immediate Care Suggestions:**
    - Provide 3–5 practical first aid or home treatment tips the user can follow safely before seeing a doctor.

    **Note:**
    - End the response with a short disclaimer that this is not a medical diagnosis and the user should consult a doctor for accurate evaluation.
`
        }
      ],
      model: "llama3.1-8b",
    });

    const result = response.choices[0].message.content;

    // console.log(result);
    res.render("result", { result }); // <-- 
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "An error occurred while processing the symptoms."
    });
  }
});
export const mediAI = router;