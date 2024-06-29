const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: process.env.SECRET_KEY, 
    resave: false,
    saveUninitialized: true
  }));
// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Routes
app.get('/', (req, res) => {
  res.render('landing', { output: null });
});
app.get('/survey', (req, res) => {
    res.render('survey'); // Render the workout survey form (workout.ejs)
});
app.get('/lifting', (req, res) => {
    res.render('lifting'); // Render the workout survey form (workout.ejs)
});
app.get('/meals', (req, res) => {
    res.render('meals'); // Render the meal survey form (meal.ejs)
});
// Route for the 'generate' page
app.get('/generate', async (req, res) => {
    // Determine if user came from workout or meal survey
    let surveyType;
    let surveyData;
    let secondaryData;

    if (req.session.workoutPreferences) {
        surveyType = 'lifting';
        surveyData = req.session.surveyData;
        secondaryData = req.session.workoutPreferences;
    } else if (req.session.mealPreferences) {
        surveyType = 'meals';
        surveyData = req.session.surveyData;
        secondaryData = req.session.mealPreferences;
    } else {
        // Handle scenario where user accessed '/generate' directly without completing surveys
        res.redirect('/survey'); // Redirect to survey if not completed
        return;
    }

    // Call Gemini API with surveyData and secondaryData to generate plan
    async function callGeminiAPI() {
        try {
            const result = await model.generateContentStream(`${surveyType} plan based on survey and secondary data. Here is the personal info: ${JSON.stringify(surveyData)}. Here are the plan requirements: ${JSON.stringify(secondaryData)}`);

            let text = '';
            for await (const chunk of result.stream) {
                text += chunk.text();
            }

            // Preprocess the text for better formatting
            const formattedText = preprocessText(text);

            // Render 'generate.ejs' with plan data and formatted text
            res.render('generate', {
                surveyType,
                plan: formattedText // Pass the formatted text to output
            });
        } catch (error) {
            console.error('Error generating content:', error);
            res.status(500).send('Error generating content.');
        }
    }

    // Function to preprocess text for HTML formatting
    function preprocessText(text) {
        // Example preprocessing: Replace asterisks with list items
        text = text.replace(/\*\*/g, '<ul><li>');
        text = text.replace(/\* /g, '</li><li>');
        text += '</li></ul>';

        // Add more preprocessing as needed (e.g., add line breaks, headings, etc.)

        return text;
    }

    // Call the function to fetch data and render the page
    callGeminiAPI();
});

// Route for the choose plan page
app.get('/choice', (req, res) => {
    res.render('choice'); // Render the choose-plan.ejs page
});

// Route to handle plan selection form submission
app.post('/select-plan', (req, res) => {
    const { planType } = req.body;

    // Redirect to the appropriate survey based on user's selection
    if (planType === 'workout') {
        res.redirect('/lifting');
    } else if (planType === 'meal') {
        res.redirect('/meals');
    } else {
        res.status(400).send('Invalid plan selection');
    }
});


app.post('/submit-lifting', (req, res) => {
    const { days, timePerDay, exerciseType } = req.body;

    // Store workout preferences in session
    req.session.workoutPreferences = {
        days: parseInt(days),
        timePerDay: parseInt(timePerDay),
        exerciseType: Array.isArray(exerciseType) ? exerciseType : [exerciseType]
    };

    // Optionally, you can redirect or send a response
    res.redirect('/generate');
});

app.post('/submit-meals', (req, res) => {
    const { mealsPerDay, snacksPerDay, packedLunch, dietaryRestrictions } = req.body;

    // Store meal preferences in session
    req.session.mealPreferences = {
        mealsPerDay: parseInt(mealsPerDay),
        snacksPerDay: parseInt(snacksPerDay),
        packedLunch,
        dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]
    };

    // Optionally, you can redirect or send a response
    res.redirect('/generate');
});

app.post('/submit-survey', (req, res) => {
    const { height, weight, age, activityLevel, goal } = req.body;

    // Store survey data in session
    req.session.surveyData = {
        height: parseFloat(height),
        weight: parseFloat(weight),
        age: parseInt(age),
        activityLevel,
        goal
    };

    // Optionally, you can redirect or send a response
    res.redirect('/choice');
});

// app.post('/submit', async (req, res) => {
//   const prompt = req.body.prompt;

//   try {
//     const result = await model.generateContentStream([prompt]); // Using generateContentStream for streaming
    
//     let text = '';
//     for await (const chunk of result.stream) {
//       const chunkText = chunk.text();
//       console.log(chunkText);
//       text += chunkText;
//       // Send partial text back to client if needed
//     }

//     res.render('landing', { output: text }); // Render landing.ejs with the final text
//   } catch (error) {
//     console.error("Error generating content:", error);
//     res.status(500).send("Error generating content.");
//   }
// });

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
