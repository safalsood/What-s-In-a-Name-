import fs from 'fs'
      
      const envConfig = JSON.parse(fs.readFileSync('env.json', 'utf8'));
      
      Object.keys(envConfig).forEach(key => {
        process.env[key] = envConfig[key];
      });