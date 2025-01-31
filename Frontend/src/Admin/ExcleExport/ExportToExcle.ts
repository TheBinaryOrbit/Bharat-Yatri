import * as xlsx from 'xlsx';

type JsonData = Record<string, unknown>[];

const exportToExcel = (jsonData: JsonData): void => {
    console.log("hwllo")
    const workBook = xlsx.utils.book_new();

    const worksheet = xlsx.utils.json_to_sheet(jsonData);

    xlsx.utils.book_append_sheet(workBook, worksheet, "Sheet 1");

    xlsx.writeFile(workBook, "data.xlsx");
};

export default exportToExcel;