// import axios from 'axios';

// const executeCode = async (code, languageChoice) => {
//     try {
//         const response = await axios.post(
//             'https://code-compiler.p.rapidapi.com/v2',
//             {
//                 LanguageChoice: languageChoice,  // Language code, like "5" for Python
//                 Program: code,
//                 Input: "", // You can add an input parameter if needed
//             },
//             {
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'X-RapidAPI-Host': 'code-compiler.p.rapidapi.com',
//                     'X-RapidAPI-Key': 'dfdd0e6370msh7713ca2e6f871aap1309b8jsn2a060f288bc8', // Replace with your API key if different
//                 },
//             }
//         );

//         // Log the full response for debugging purposes
//         console.log('API Response:', response.data);

//         if (response.data && response.data.Result !== undefined) {
//             return {
//                 success: true,
//                 output: response.data.Result || "No output received.",
//             };
//         } else {
//             return {
//                 success: false,
//                 output: "Unexpected response format or no output returned from the server.",
//             };
//         }
//     } catch (error) {
//         return {
//             success: false,
//             output: `Error: ${error.message}`,
//         };
//     }
// };

// export default executeCode;


import axios from 'axios';

const executeCode = async (code, languageChoice, inputData = "") => {
    try {
        const response = await axios.post(
            'https://code-compiler.p.rapidapi.com/v2',
            {
                LanguageChoice: languageChoice,  // Language code, e.g., "5" for Python
                Program: code,
                Input: inputData, // Now accepts user-provided input
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Host': 'code-compiler.p.rapidapi.com',
                    'X-RapidAPI-Key': 'dfdd0e6370msh7713ca2e6f871aap1309b8jsn2a060f288bc8', // Replace with your API key if needed
                },
            }
        );

        // Log the full response for debugging purposes
        console.log('API Response:', response.data);

        if (response.data && response.data.Result !== undefined) {
            return {
                success: true,
                output: response.data.Result || "No output received.",
            };
        } else {
            return {
                success: false,
                output: "Unexpected response format or no output returned from the server.",
            };
        }
    } catch (error) {
        return {
            success: false,
            output: `Error: ${error.message}`,
        };
    }
};

export default executeCode;
