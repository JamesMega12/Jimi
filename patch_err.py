import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace('    } catch (apiErr: any) {\n      return res.status(502).json({ error: "AI analysis is temporarily unavailable. Please try again." });', '    } catch (apiErr: any) {\n      console.error("[analyze-summary] Gemini API Error:", apiErr);\n      return res.status(502).json({ error: "AI analysis is temporarily unavailable. Please try again." });')

with open('server.ts', 'w') as f:
    f.write(content)
