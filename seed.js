import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

async function main() {
  const results = [];
  
  // Assuming a 'complaints.csv' file exists in the root directory
  if (!fs.existsSync('complaints.csv')) {
    console.log('complaints.csv not found. Skipping seed.');
    return;
  }

  fs.createReadStream('complaints.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Read ${results.length} rows from CSV.`);
      
      for (const row of results) {
        let responseText = null;
        if (row.metadata_json) {
          try {
            const metadata = JSON.parse(row.metadata_json);
            if (metadata && metadata['Dari']) {
              responseText = metadata['Dari'];
            }
          } catch (e) {
            console.error(`Error parsing metadata_json for issue ${row.issue_code}`, e);
          }
        }

        const submittedAt = row.submitted_at_iso ? new Date(row.submitted_at_iso) : null;

        await prisma.complaint.upsert({
          where: { issue_code: row.issue_code },
          update: {
            title: row.title,
            content: row.content,
            agency: row.agency,
            response_text: responseText,
            source_channel: row.source_channel,
            detail_url: row.detail_url,
            ...(submittedAt && !isNaN(submittedAt.getTime()) && { submitted_at_iso: submittedAt }),
          },
          create: {
            issue_code: row.issue_code,
            title: row.title || '',
            content: row.content || '',
            agency: row.agency,
            response_text: responseText,
            source_channel: row.source_channel,
            detail_url: row.detail_url,
            submitted_at_iso: submittedAt && !isNaN(submittedAt.getTime()) ? submittedAt : null,
          },
        });
      }
      console.log('Seeding completed.');
    });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
