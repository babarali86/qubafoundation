const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from admin-web directory
app.use(express.static(path.join(__dirname, "../admin-web")));

/**
 * POST: /reverse-geocode
 * body: { latitude, longitude }
 */
app.post("/reverse-geocode", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: "Latitude and Longitude are required",
    });
  }

  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "jsonv2",
          addressdetails: 1,
          "accept-language": "en-US,en;q=0.9",
        },
        headers: {
          "User-Agent": "ExactLocationBackend/1.0",
        },
      }
    );

    const address = response.data.address;

    const exactLocation = {
      houseNumber: address.house_number || null,
      road: address.road || null,
      neighbourhood: address.neighbourhood || null,
      suburb: address.suburb || null,
      city: address.city || address.town || address.village || null,
      state: address.state || null,
      postalCode: address.postcode || null,
      country: address.country || null,
      fullAddress: response.data.display_name,
    };

    res.status(200).json({
      success: true,
      location: exactLocation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch exact location",
    });
  }
});
app.post("/generate-certificate", async (req, res) => {
  const {
    projectType,
    projectCode,
    location,
    latitude,
    longitude,
    deceasedName,
  } = req.body;

  if (
    !projectType ||
    !projectCode ||
    !location ||
    !latitude ||
    !longitude
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const templatePath = path.join(__dirname, "certificate_template.pdf");
    const existingPdfBytes = fs.readFileSync(templatePath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // ✅ Register fontkit
    pdfDoc.registerFontkit(fontkit);

    const page = pdfDoc.getPages()[0];

    const fontBytes = fs.readFileSync(
      path.join(__dirname, "NotoNaskhArabic-Regular.ttf")
    );
    const font = await pdfDoc.embedFont(fontBytes);

    page.drawText(projectType, { x: 180, y: 180, size: 14, font });
    page.drawText(projectCode, { x: 180, y: 160, size: 14, font });
    page.drawText(location, { x: 150, y: 140, size: 14, font });
    page.drawText(latitude.toString(), { x: 126, y: 118, size: 12, font });
    page.drawText(longitude.toString(), { x: 270, y: 118, size: 12, font });

    // Add deceased name in correct position with bold styling
    const deceasedNameToUse = deceasedName || "KHAWJA SHAMIM AHMAD (LATE)";
    page.drawText(deceasedNameToUse, { x: 310, y: 355, size: 16, font });

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=certificate.pdf"
    );
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("PDF Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate certificate",
    });
  }
});




app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
